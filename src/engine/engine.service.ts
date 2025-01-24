import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Chess, validateFen } from 'chess.js';
import { Worker } from 'worker_threads';
import { join } from 'path';

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
export class EngineService implements OnModuleDestroy {
  private worker: Worker | null = null;

  constructor() {
    this.worker = this.initWorker();
  }

  /**
   * Inicializa un Worker con el motor de Stockfish.
   * @returns Una instancia de Worker.
   */
  private initWorker(): Worker {
    const workerPath = join(__dirname, 'stockfish/stockfish-16.1.js'); // Ruta del binario Stockfish
    const worker = new Worker(workerPath, {
      execArgv: [], // Configuración para evitar argumentos adicionales en Node.js
    });

    // Configuración inicial del motor
    worker.postMessage('uci');
    worker.postMessage('setoption name MultiPV value 2');

    return worker;
  }

  /**
   * Evalúa una posición FEN utilizando Stockfish.
   * @param fen La posición en formato FEN.
   * @param depth La profundidad del análisis.
   * @param verbose Si se desea mostrar logs detallados.
   * @returns Un arreglo con las mejores líneas evaluadas.
   */
  async evaluatePosition(
    fen: string,
    depth: number,
    verbose = false
  ): Promise<EngineLine[]> {
    if (!this.isValidFen(fen)) {
      throw new Error('Formato FEN inválido.');
    }

    // Reinicia el motor si no existe o fue terminado.
    if (!this.worker) {
      this.worker = this.initWorker();
    }

    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);

    const messages: string[] = [];
    const lines: EngineLine[] = [];

    return new Promise((resolve, reject) => {
      const onMessage = (event: { data: string }) => {
        const message = event.data;
        messages.unshift(message);

        if (verbose) console.log('[Stockfish]:', message);

        const latestDepth = parseInt(message.match(/depth (\d+)/)?.[1] || '0');

        if (message.startsWith('bestmove') || message.includes('depth 0')) {
          const searchMessages = messages.filter((msg) =>
            msg.startsWith('info depth')
          );

          for (const searchMessage of searchMessages) {
            const idString = searchMessage.match(/multipv (\d+)/)?.[1];
            const depthString = searchMessage.match(/depth (\d+)/)?.[1];
            const moveUCI = searchMessage.match(/ pv (.+?) (?= |$)/)?.[1];
            const evaluation: Evaluation = {
              type: searchMessage.includes(' cp ') ? 'cp' : 'mate',
              value: parseInt(
                searchMessage.match(/(?:cp |mate )([-+]?\d+)/)?.[1] || '0'
              ),
            };

            // Cambia el signo de evaluación si es el turno de las negras.
            if (fen.includes(' b ')) evaluation.value *= -1;

            if (!idString || !depthString || !moveUCI) continue;

            const id = parseInt(idString);
            const depth = parseInt(depthString);

            if (depth !== latestDepth || lines.some((line) => line.id === id)) {
              continue;
            }

            lines.push({
              id,
              depth,
              evaluation,
              moveUCI,
            });
          }

          this.cleanupWorker();
          resolve(lines);
        }
      };

      const onError = () => {
        this.cleanupWorker();
        reject(new Error('Stockfish worker encountered an error.'));
      };

      this.worker.on('message', onMessage);
      this.worker.on('error', onError);
    });
  }

  /**
   * Analiza múltiples posiciones usando Stockfish.
   * @param positions Lista de posiciones con formato FEN y sus movimientos.
   * @param depth La profundidad del análisis.
   * @returns Un informe con las evaluaciones de cada posición.
   */
  async analysePositions(
    positions: { fen: string; move: string }[],
    depth = 20
  ): Promise<{ fen: string; move: string; topLines: EngineLine[] }[]> {
    const report: { fen: string; move: string; topLines: EngineLine[] }[] = [];

    for (const position of positions) {
      const topLines = await this.evaluatePosition(position.fen, depth);
      report.push({
        fen: position.fen,
        move: position.move,
        topLines,
      });
    }

    return report;
  }

  /**
   * Detiene el motor y libera recursos.
   */
  stopEngine(): void {
    this.cleanupWorker();
  }

  /**
   * Limpia el recurso del Worker.
   */
  private cleanupWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Comprueba si el formato FEN es válido.
   * @param fen La posición en formato FEN.
   * @returns True si el FEN es válido.
   */
  private isValidFen(fen: string): boolean {
    const valid = validateFen(fen);
    return valid.ok;
  }

  /**
   * Hook para limpiar recursos al destruir el módulo.
   */
  onModuleDestroy(): void {
    this.stopEngine();
  }

  /**
   * Calcula la diferencia en la evaluación entre dos posiciones consecutivas.
   * @param current La evaluación de la posición actual.
   * @param previous La evaluación de la posición anterior.
   * @returns El cambio de evaluación (delta).
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
   * Obtiene el mejor movimiento sugerido por el motor.
   * @param engineLines Las líneas de evaluación del motor.
   * @param fen La posición actual en FEN.
   * @returns Objeto con el movimiento en ambas notaciones UCI y SAN.
   */
  getSuggestedMove(engineLines: EngineLine[], fen: string): { san: string; uci: string } {
    if (!engineLines || engineLines.length === 0) {
      throw new Error('No se encontraron líneas evaluadas por el motor.');
    }

    const bestLine = engineLines[0];

    if (!bestLine.moveUCI) {
      throw new Error('No se encontró la notación UCI para el movimiento sugerido.');
    }

    const san = bestLine.moveSAN ?? this.convertUCItoSAN(bestLine.moveUCI, fen);

    return {
      san,
      uci: bestLine.moveUCI,
    };
  }

  /**
   * Convierte un movimiento de notación UCI a SAN usando chess.js.
   * @param uci Movimiento en notación UCI.
   * @param fen La posición actual en FEN.
   * @returns Movimiento en notación SAN.
   */
  private convertUCItoSAN(uci: string, fen: string): string {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.substring(0, 2),
      to: uci.substring(2, 4),
      promotion: uci[4],
    });
    return move?.san ?? uci;
  }
}
