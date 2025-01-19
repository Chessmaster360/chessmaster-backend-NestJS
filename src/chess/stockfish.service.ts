import { Injectable } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import { Chess } from 'chess.js';
import { binaryPath } from 'config/paths'; // Ruta al ejecutable de Stockfish.


@Injectable()
export class StockfishService {
  analyzeGame(pgn: string, depth: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const stockfish = this.initializeStockfish();

      let output = '';
      let errorOccurred = false;

      stockfish.stdout.on('data', (data) => {
        output += data.toString();
      });

      stockfish.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
        errorOccurred = true;
      });

      stockfish.on('close', (code) => {
        if (errorOccurred || code !== 0) {
          reject(`Stockfish process exited with code ${code}`);
        } else {
          const analysis = this.processStockfishOutput(output);
          resolve(analysis);
        }
      });

      this.sendCommandsToStockfish(stockfish, pgn, depth);
    });
  }

  private checkStockfishBinary(): boolean {
    return fs.existsSync(binaryPath); // Usa el binaryPath de config/paths.
  }

  private initializeStockfish(): ChildProcessWithoutNullStreams {
    if (!this.checkStockfishBinary()) {
      throw new Error('Stockfish binary not found');
    }
    return spawn(binaryPath); // Usa el binaryPath de config/paths.
  }


  private sendCommandsToStockfish(stockfish: ChildProcessWithoutNullStreams, pgn: string, depth: number): void {
    stockfish.stdin.write('uci\n');
    stockfish.stdin.write('isready\n');
    stockfish.stdin.write(`position startpos moves ${this.pgnToMoves(pgn)}\n`);
    stockfish.stdin.write(`go depth ${depth}\n`);
  }

  private pgnToMoves(pgn: string): string {
    const chess = new Chess();
    chess.loadPgn(pgn);
    return chess.history().join(' ');
  }

  private processStockfishOutput(output: string): any {
    const movesAnalysis = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('info depth')) {
        const moveAnalysis = this.parseMoveAnalysis(line);
        if (moveAnalysis) {
          movesAnalysis.push(moveAnalysis);
        }
      }
    });

    const accuracy = this.calculateAccuracy(movesAnalysis);
    return {
      accuracy,
      moves: movesAnalysis
    };
  }

  private parseMoveAnalysis(line: string): any {
    const regex = /info depth (\d+) .* score (\w+) (-?\d+) .* pv (.+)/;
    const match = line.match(regex);
    if (!match) {
      console.warn('Unexpected Stockfish output:', line);
      return null;
    }  
    if (match) {
      const [, depth, scoreType, score, moves] = match;
      const classification = this.classifyMove(parseInt(score), scoreType);
      return {
        depth: parseInt(depth),
        score: parseInt(score),
        scoreType,
        moves: moves.split(' '),
        classification
      };
    }
    return null;
  }

  private classifyMove(score: number, scoreType: string): string {
    if (scoreType === 'mate') {
      return score > 0 ? 'Brilliant' : 'Blunder';
    } else if (scoreType === 'cp') {
      if (score >= 50) return 'Great';
      if (score >= 20) return 'Good';
      if (score >= 10) return 'Inaccuracy';
      if (score >= -10) return 'Excellent';
      if (score < -10) return 'Mistake';
      if (score < -20) return 'Blunder';
    }
    return 'Unknown';
  }

  private calculateAccuracy(moves: any[]): number {
    let totalPoints = 0;
    let totalMoves = moves.length;

    moves.forEach(move => {
      totalPoints += this.assignPoints(move.classification);
    });

    return (totalPoints / (totalMoves * this.maxPointsPerMove())) * 100;
  }

  private assignPoints(classification: string): number {
    const pointsMapping = {
      'Brilliant': 5,
      'Great': 4,
      'Excellent': 3,
      'Good': 2,
      'Inaccuracy': 1,
      'Mistake': 0,
      'Blunder': -2
    };
    return pointsMapping[classification] || 0;
  }

  private maxPointsPerMove(): number {
    return 5;
  }
}
