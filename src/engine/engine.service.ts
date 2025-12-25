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
   * Returns best available results even if target depth not reached
   */
  private parseAnalysisResults(): EngineLine[] {
    const linesByDepth: Map<number, EngineLine[]> = new Map();

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

      const evaluation: Evaluation = {
        type: mateMatch ? 'mate' : 'cp',
        value: mateMatch ? parseInt(mateMatch[1]) : (cpMatch ? parseInt(cpMatch[1]) : 0),
      };

      if (!linesByDepth.has(depth)) {
        linesByDepth.set(depth, []);
      }

      const depthLines = linesByDepth.get(depth)!;
      if (!depthLines.some(l => l.id === id)) {
        depthLines.push({ id, depth, evaluation, moveUCI });
      }
    }

    // Get the highest depth that has results
    const depths = Array.from(linesByDepth.keys()).sort((a, b) => b - a);
    const bestDepth = depths[0];

    if (!bestDepth) {
      return [];
    }

    const lines = linesByDepth.get(bestDepth) || [];
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
   * Check if position is terminal (checkmate or stalemate)
   */
  private isTerminalPosition(fen: string): { isTerminal: boolean; result?: string } {
    try {
      const chess = new Chess(fen);
      if (chess.isCheckmate()) {
        return { isTerminal: true, result: 'checkmate' };
      }
      if (chess.isStalemate()) {
        return { isTerminal: true, result: 'stalemate' };
      }
      if (chess.isDraw()) {
        return { isTerminal: true, result: 'draw' };
      }
      return { isTerminal: false };
    } catch {
      return { isTerminal: false };
    }
  }

  /**
   * Evaluate a position using Stockfish
   */
  async evaluatePosition(fen: string, depth: number): Promise<EngineLine[]> {
    if (!this.isValidFen(fen)) {
      throw new Error('Invalid FEN format');
    }

    // Check for terminal position (checkmate, stalemate, draw)
    const terminalCheck = this.isTerminalPosition(fen);
    if (terminalCheck.isTerminal) {
      // Return a synthetic evaluation for terminal positions
      const chess = new Chess(fen);
      const evaluation: Evaluation = terminalCheck.result === 'checkmate'
        ? { type: 'mate', value: 0 } // Already mated
        : { type: 'cp', value: 0 }; // Draw

      return [{
        id: 1,
        depth: depth,
        evaluation,
        moveUCI: '', // No legal moves in terminal position
      }];
    }

    return this.evaluatePositionInternal(fen, depth);
  }

  /**
   * Internal position evaluation
   */
  private async evaluatePositionInternal(fen: string, depth: number): Promise<EngineLine[]> {
    // Ensure engine is ready
    if (!this.stockfish || !this.isReady) {
      await this.initEngine();
    }

    // CRITICAL: Clear state BEFORE sending new position
    this.currentMessages = [];
    this.currentDepth = 0;
    this.pendingResolve = null;

    try {
      // Sync with engine before each position (without ucinewgame which is slow)
      await this.sendCommand('isready');
      await this.waitForReady(10000);
    } catch (error) {
      console.error('Engine sync timeout, restarting...', error.message);
      await this.restartEngine();
    }

    // Clear messages again after sync
    this.currentMessages = [];

    // Set position and start analysis
    await this.sendCommand(`position fen ${fen}`);
    await this.sendCommand(`go depth ${depth}`);

    // Timeout scales with depth (5 seconds + 2 seconds per depth level, max 60s)
    const timeoutMs = Math.min(60000, Math.max(15000, 5000 + depth * 2000));

    // Wait for analysis to complete
    return new Promise((resolve) => {
      this.pendingResolve = resolve;

      // Timeout - return partial results instead of rejecting
      setTimeout(async () => {
        if (this.pendingResolve) {
          await this.sendCommand('stop');
          // Small delay for final results
          await new Promise(r => setTimeout(r, 200));
          const partialResults = this.parseAnalysisResults();
          const resolve = this.pendingResolve;
          // CRITICAL: Clear state BEFORE resolving to prevent race conditions
          this.pendingResolve = null;
          this.currentMessages = [];
          if (resolve) {
            resolve(partialResults);
          }
        }
      }, timeoutMs);
    });
  }

  /**
   * Evaluate position with retry logic
   * Tries up to 3 times with decreasing depth if no results
   */
  async evaluatePositionWithRetry(fen: string, depth: number, maxRetries = 3): Promise<EngineLine[]> {
    let currentDepth = depth;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const results = await this.evaluatePosition(fen, currentDepth);

        if (results && results.length > 0) {
          return results;
        }

        // No results - try with lower depth
        console.warn(`Attempt ${attempt + 1}: No results for ${fen.substring(0, 30)}... at depth ${currentDepth}`);
        currentDepth = Math.max(8, currentDepth - 4); // Reduce depth, minimum 8

        // Reset engine if it seems stuck
        if (attempt > 0) {
          console.log('Restarting engine...');
          await this.restartEngine();
        }
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        currentDepth = Math.max(8, currentDepth - 4);
      }
    }

    // Final fallback - return empty (will be handled by AnalysisService)
    return [];
  }

  /**
   * Restart the engine (for recovery)
   */
  private async restartEngine(): Promise<void> {
    if (this.stockfish) {
      this.stockfish.stdin.write('quit\n');
      this.stockfish.kill();
      this.stockfish = null;
      this.isReady = false;
    }
    await new Promise(r => setTimeout(r, 500));
    await this.initEngine();
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
