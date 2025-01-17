// src/chess/stockfish.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Chess } from 'chess.js';

interface StockfishEvaluation {
  depth: number;
  score: number | string;
  bestLine?: string;
  mate?: number;
}

interface PositionAnalysis {
  fen: string;
  evaluation: StockfishEvaluation;
  bestMove: string;
}

@Injectable()
export class StockfishService implements OnModuleInit, OnModuleDestroy {
  private stockfish: ChildProcess;
  private eventEmitter: EventEmitter;
  private isEngineReady = false;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  async onModuleInit() {
    // Inicializar Stockfish cuando el módulo arranca
    await this.initializeStockfish();
  }

  onModuleDestroy() {
    // Cerrar Stockfish cuando el módulo se destruye
    if (this.stockfish) {
      this.stockfish.stdin.write('quit\n');
      this.stockfish.kill();
    }
  }

  private async initializeStockfish(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Iniciar proceso de Stockfish
        this.stockfish = spawn('stockfish');
        
        this.stockfish.stdout.on('data', (data) => {
          const output = data.toString();
          
          // Emitir la salida para el procesamiento
          this.eventEmitter.emit('stockfishOutput', output);
          
          // Verificar si el motor está listo
          if (output.includes('uciok')) {
            this.isEngineReady = true;
            this.eventEmitter.emit('engineReady');
          }
        });

        this.stockfish.stderr.on('data', (data) => {
          console.error(`Stockfish Error: ${data}`);
        });

        // Configurar UCI
        this.stockfish.stdin.write('uci\n');
        
        // Esperar a que el motor esté listo
        this.eventEmitter.once('engineReady', () => {
          // Configurar opciones del motor
          this.configureEngine();
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private configureEngine(): void {
    // Configurar opciones básicas del motor
    const config = [
      'setoption name Hash value 128',
      'setoption name Threads value 4',
      'setoption name MultiPV value 1',
      'setoption name UCI_ShowWDL value true',
      'isready'
    ];

    for (const command of config) {
      this.stockfish.stdin.write(command + '\n');
    }
  }

  async analyzePGN(pgn: string, depth: number): Promise<any> {
    const moves = this.parsePGN(pgn);
    const analyses: PositionAnalysis[] = [];

    for (let i = 0; i < moves.length; i++) {
      const position = await this.analyzePosition(moves.slice(0, i + 1), depth);
      analyses.push(position);
    }

    return this.generateAnalysisReport(analyses);
  }

  private async analyzePosition(moves: string[], depth: number): Promise<PositionAnalysis> {
    return new Promise((resolve) => {
      let currentEvaluation: StockfishEvaluation = null;
      let bestMove: string = null;

      // Manejador para la salida de Stockfish
      const outputHandler = (output: string) => {
        // Procesar evaluación
        if (output.includes('info depth')) {
          const evaluation = this.parseEvaluation(output);
          if (evaluation && evaluation.depth === depth) {
            currentEvaluation = evaluation;
          }
        }
        // Procesar mejor movimiento
        else if (output.includes('bestmove')) {
          bestMove = output.split(' ')[1];
          
          // Eliminar el listener y resolver
          this.eventEmitter.removeListener('stockfishOutput', outputHandler);
          resolve({
            fen: this.getCurrentFEN(moves),
            evaluation: currentEvaluation,
            bestMove
          });
        }
      };

      // Añadir listener temporal
      this.eventEmitter.on('stockfishOutput', outputHandler);

      // Enviar comandos a Stockfish
      const position = moves.length === 0 ? 'startpos' : `startpos moves ${moves.join(' ')}`;
      this.stockfish.stdin.write(`position ${position}\n`);
      this.stockfish.stdin.write(`go depth ${depth}\n`);
    });
  }

  private parseEvaluation(line: string): StockfishEvaluation | null {
    const depthMatch = line.match(/depth (\d+)/);
    const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
    const pvMatch = line.match(/pv (.+)/);

    if (!depthMatch || !scoreMatch) return null;

    const depth = parseInt(depthMatch[1]);
    const scoreType = scoreMatch[1];
    const scoreValue = parseInt(scoreMatch[2]);

    return {
      depth,
      score: scoreType === 'cp' ? scoreValue / 100 : scoreValue,
      bestLine: pvMatch ? pvMatch[1] : undefined,
      mate: scoreType === 'mate' ? scoreValue : undefined
    };
  }

  private parsePGN(pgn: string): string[] {
    try {
      // Inicializar nuevo juego de ajedrez
      const chess = new Chess();
      
      // Limpiar el PGN
      pgn = pgn
        // Eliminar comentarios entre llaves
        .replace(/\{[^}]*\}/g, '')
        // Eliminar comentarios entre paréntesis
        .replace(/\([^)]*\)/g, '')
        // Eliminar números de movimiento
        .replace(/\d+\./g, '')
        // Eliminar puntuación de movimientos
        .replace(/[!?#+]+/g, '')
        // Eliminar resultado de la partida
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '')
        // Eliminar espacios múltiples
        .replace(/\s+/g, ' ')
        .trim();
  
      // Cargar el PGN limpio
      chess.loadPgn(pgn);
  
      // Obtener el historial de movimientos en formato UCI
      const moves = chess.history({ verbose: true }).map(move => {
        // Convertir al formato UCI (ejemplo: e2e4)
        return move.from + move.to + (move.promotion || '');
      });
  
      return moves;
    } catch (error) {
      console.error('Error parsing PGN:', error);
      throw new Error('Invalid PGN format');
    }
  }
  
  private getCurrentFEN(moves: string[]): string {
    try {
      // Inicializar nuevo juego de ajedrez
      const chess = new Chess();
      
      // Aplicar cada movimiento UCI
      for (const move of moves) {
        // Convertir formato UCI a objeto de movimiento
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.length > 4 ? move.substring(4, 5) : undefined;
        
        // Realizar el movimiento
        chess.move({
          from,
          to,
          promotion
        });
      }
      
      // Retornar la posición FEN actual
      return chess.fen();
    } catch (error) {
      console.error('Error generating FEN:', error);
      throw new Error('Invalid move sequence');
    }
  }

  
  // Método auxiliar para convertir movimiento algebraico a UCI
  private algebraicToUCI(chess: Chess, moveAlgebraic: string): string {
    const move = chess.move(moveAlgebraic, { strict: false });
    if (!move) return null;
    
    chess.undo();
    return move.from + move.to + (move.promotion || '');
  }
  
  // Método para obtener todos los FEN intermedios
  private getAllPositionsFEN(moves: string[]): string[] {
    const positions: string[] = [];
    const chess = new Chess();
    
    // Añadir posición inicial
    positions.push(chess.fen());
    
    // Añadir posición después de cada movimiento
    for (const move of moves) {
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move.substring(4, 5) : undefined;
      
      chess.move({ from, to, promotion });
      positions.push(chess.fen());
    }
    
    return positions;
  }

  private generateAnalysisReport(analyses: PositionAnalysis[]): any {
    const report = {
      moves: analyses.length,
      evaluations: analyses.map(a => ({
        move: a.bestMove,
        evaluation: a.evaluation.score,
        depth: a.evaluation.depth,
        mate: a.evaluation.mate
      })),
      summary: {
        excellent: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0
      }
    };

    // Analizar la calidad de cada movimiento
    for (let i = 1; i < analyses.length; i++) {
        const prevScore = (typeof analyses[i - 1].evaluation.score === 'number'
            ? analyses[i - 1].evaluation.score
            : 0) as number;
          
          const currentScore = (typeof analyses[i].evaluation.score === 'number'
            ? analyses[i].evaluation.score
            : 0) as number;
          
          const evalDiff = Math.abs(currentScore - prevScore);

      if (evalDiff < 0.5) report.summary.excellent++;
      else if (evalDiff < 1.0) report.summary.good++;
      else if (evalDiff < 2.0) report.summary.inaccuracy++;
      else if (evalDiff < 3.0) report.summary.mistake++;
      else report.summary.blunder++;
    }

    return report;
  }
}