import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Chess, validateFen } from 'chess.js';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

interface Evaluation {
  type: 'cp' | 'mate';
  value: number;
}

interface EngineLine {
  id: number;
  depth: number;
  evaluation: Evaluation;
  moveUCI: string;
  moveSAN?: string;
}

@Injectable()
export class EngineService implements OnModuleInit, OnModuleDestroy {
  private stockfish: ChildProcessWithoutNullStreams | null = null;
  private stockfishPath: string;
  private isReady = false;
  private pendingResolve: ((lines: EngineLine[]) => void) | null = null;
  private currentMessages: string[] = [];
  private currentDepth = 0;

  constructor() {
    // Determine stockfish path based on OS
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'stockfish-windows-x86-64-avx2.exe' : 'stockfish';
    this.stockfishPath = join(__dirname, 'stockfish', binaryName);
  }

  async onModuleInit() {
    await this.initEngine();
  }

  /**
   * Initialize the Stockfish engine
   */
  private async initEngine(): Promise<void> {
    // Check if binary exists
    if (!existsSync(this.stockfishPath)) {
      console.error(`Stockfish binary not found at: ${this.stockfishPath}`);
      throw new Error('Stockfish binary not found. Please ensure stockfish is installed.');
    }

    console.log(`🔧 Starting Stockfish from: ${this.stockfishPath}`);

    // Spawn the stockfish process
    this.stockfish = spawn(this.stockfishPath);

    // Handle stdout
    this.stockfish.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        this.handleMessage(line);
      }
    });

    // Handle stderr
    this.stockfish.stderr.on('data', (data: Buffer) => {
      console.error(`Stockfish stderr: ${data}`);
    });

    // Handle exit
    this.stockfish.on('close', (code) => {
      console.log(`Stockfish process exited with code ${code}`);
      this.stockfish = null;
      this.isReady = false;
    });

    // Initialize UCI protocol - wait for 'uciok'
    this.sendCommand('uci');
    await this.waitForMessage('uciok', 10000);

    // Configure MultiPV
    this.sendCommand('setoption name MultiPV value 2');
    this.sendCommand('isready');
    await this.waitForMessage('readyok', 10000);

    this.isReady = true;
    console.log('✅ Stockfish engine initialized successfully');
  }

  /**
   * Handle a message from Stockfish
   */
  private handleMessage(message: string): void {
    // Store messages for analysis parsing
    this.currentMessages.push(message);

    // Check for ready state
    if (message === 'readyok') {
      this.isReady = true;
    }

    // Parse depth from info messages
    const depthMatch = message.match(/depth (\d+)/);
    if (depthMatch) {
      this.currentDepth = parseInt(depthMatch[1]);
    }

    // Check for bestmove (analysis complete)
    if (message.startsWith('bestmove') && this.pendingResolve) {
      const lines = this.parseAnalysisResults();
      this.pendingResolve(lines);
      this.pendingResolve = null;
      this.currentMessages = [];
    }
  }

  /**
   * Parse analysis results from accumulated messages
   */
  private parseAnalysisResults(): EngineLine[] {
    const lines: EngineLine[] = [];
    const latestDepth = this.currentDepth;

    for (const message of this.currentMessages) {
      if (!message.startsWith('info depth')) continue;

      const depthMatch = message.match(/depth (\d+)/);
      const multipvMatch = message.match(/multipv (\d+)/);
      const moveMatch = message.match(/ pv ([a-h][1-8][a-h][1-8][qrbnQRBN]?)/);
      const cpMatch = message.match(/score cp (-?\d+)/);
      const mateMatch = message.match(/score mate (-?\d+)/);

      if (!depthMatch || !moveMatch) continue;

      const depth = parseInt(depthMatch[1]);
      const id = multipvMatch ? parseInt(multipvMatch[1]) : 1;
      const moveUCI = moveMatch[1];

      // Only use results from the latest depth
      if (depth !== latestDepth) continue;
      if (lines.some(l => l.id === id)) continue;

      const evaluation: Evaluation = {
        type: mateMatch ? 'mate' : 'cp',
        value: mateMatch ? parseInt(mateMatch[1]) : (cpMatch ? parseInt(cpMatch[1]) : 0),
      };

      lines.push({
        id,
        depth,
        evaluation,
        moveUCI,
      });
    }

    // Sort by multipv id
    lines.sort((a, b) => a.id - b.id);
    return lines;
  }

  /**
   * Send a command to Stockfish
   */
  private sendCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stockfish) {
        reject(new Error('Stockfish not initialized'));
        return;
      }
      this.stockfish.stdin.write(`${command}\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Wait for Stockfish to be ready
   */
  private waitForReady(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (this.isReady) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Stockfish ready timeout'));
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Wait for a specific message from Stockfish
   */
  private waitForMessage(expectedMessage: string, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        // Check if any accumulated message contains expected message
        if (this.currentMessages.some(msg => msg.includes(expectedMessage))) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for: ${expectedMessage}`));
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Evaluate a position using Stockfish
   */
  async evaluatePosition(fen: string, depth: number): Promise<EngineLine[]> {
    if (!this.isValidFen(fen)) {
      throw new Error('Invalid FEN format');
    }

    // Ensure engine is ready
    if (!this.stockfish || !this.isReady) {
      await this.initEngine();
    }

    // Clear previous messages
    this.currentMessages = [];
    this.currentDepth = 0;

    // Set position and start analysis
    await this.sendCommand(`position fen ${fen}`);
    await this.sendCommand(`go depth ${depth}`);

    // Wait for analysis to complete
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          reject(new Error('Analysis timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Validate FEN format
   */
  private isValidFen(fen: string): boolean {
    return validateFen(fen).ok;
  }

  /**
   * Calculate evaluation delta between two positions
   */
  calculateEvaluationDelta(current: Evaluation, previous: Evaluation): number {
    if (current.type === 'mate' || previous.type === 'mate') {
      if (current.type === 'mate' && previous.type === 'mate') {
        return current.value - previous.value;
      }
      return current.type === 'mate' ? 1000 : -1000;
    }
    return current.value - previous.value;
  }

  /**
   * Get the suggested best move
   */
  getSuggestedMove(engineLines: EngineLine[], fen: string): { san: string; uci: string } {
    if (!engineLines || engineLines.length === 0) {
      throw new Error('No engine lines available');
    }

    const bestLine = engineLines[0];
    const san = this.convertUCItoSAN(bestLine.moveUCI, fen);

    return {
      san,
      uci: bestLine.moveUCI,
    };
  }

  /**
   * Convert UCI to SAN notation
   */
  private convertUCItoSAN(uci: string, fen: string): string {
    try {
      const chess = new Chess(fen);
      const move = chess.move({
        from: uci.substring(0, 2),
        to: uci.substring(2, 4),
        promotion: uci[4] as any,
      });
      return move?.san ?? uci;
    } catch {
      return uci;
    }
  }

  /**
   * Stop any running analysis
   */
  async stopAnalysis(): Promise<void> {
    if (this.stockfish) {
      await this.sendCommand('stop');
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.stockfish) {
      this.stockfish.stdin.write('quit\n');
      this.stockfish.kill();
      this.stockfish = null;
    }
  }
}
