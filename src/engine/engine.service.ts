import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Chess, validateFen } from 'chess.js';

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
   * Inicializa un Web Worker con la configuración adecuada.
   * @returns Una instancia del Web Worker.
   */
  private initWorker(): Worker {
    const worker = new Worker(
      typeof WebAssembly === 'object'
        ? '/stockfish/stockfish-16.1-single.js'
        : '/stockfish/stockfish-16.1.js'
    );

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
      const onMessage = (event: MessageEvent) => {
        const message: string = event.data;
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

      this.worker.addEventListener('message', onMessage);
      this.worker.addEventListener('error', onError);
    });
  }

  /**
   * Analiza múltiples posiciones usando Stockfish.
   * @param positions Lista de posiciones con formato FEN.
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
   * Limpia el recurso del Web Worker.
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
    if (current.type === "mate" || previous.type === "mate") {
      // Evaluación especial para jugadas de mate.
      if (current.type === "mate" && previous.type === "mate") {
        return current.value - previous.value;
      }
      // Si uno de los valores no es "mate", asignar un cambio grande.
      return current.type === "mate" ? 1000 : -1000;
    }
    // Evaluación estándar (type === "cp").
    return current.value - previous.value;
  }

  /**
   * Obtiene el mejor movimiento sugerido por el motor.
   * @param engineLines Las líneas de evaluación del motor.
   * @returns El movimiento en notación SAN (si está disponible) o UCI.
   */
  getSuggestedMove(engineLines: EngineLine[]): string {
    if (!engineLines || engineLines.length === 0) {
      throw new Error("No se encontraron líneas evaluadas por el motor.");
    }

    const bestLine = engineLines[0]; // La mejor línea siempre es la primera.
    return bestLine.moveSAN ?? bestLine.moveUCI; // Prefiere SAN, pero usa UCI si SAN no está disponible.
  }
}
