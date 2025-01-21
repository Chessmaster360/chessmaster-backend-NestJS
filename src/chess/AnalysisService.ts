import { Injectable } from '@nestjs/common';
import { ChessService } from './chess.service';
import { EngineService } from '../engine/engine.service';
import { Position, EvaluatedPosition, Report } from '../interfaces/analysis.interfaces';

@Injectable()
export class AnalysisService {
  
  constructor(
    private readonly chessService: ChessService,
    private readonly engineService: EngineService,
  ) {}

  /**
   * Orquesta el flujo completo del análisis de una partida.
   * @param pgn El PGN de la partida.
   * @param depth La profundidad del análisis.
   * @returns Un reporte con la precisión y clasificación de movimientos.
   */
  async analyzeGame(pgn: string, depth: number): Promise<Report> {
    try {
      // Paso 1: Parsear el PGN a posiciones.
      const positions: Position[] = this.chessService.parsePgn(pgn);
      if (!positions || positions.length === 0) {
        throw new Error('No se encontraron posiciones en el PGN proporcionado.');
      }

      // Paso 2: Analizar cada posición y clasificar movimientos.
      const evaluatedPositions = await this.classifyAndSuggest(positions, depth);

      // Paso 3: Calcular la precisión total.
      const accuracy = this.chessService.calculateAccuracy(
        evaluatedPositions.map((pos) => pos.classification),
      );

      // Paso 4: Generar el reporte final.
      return this.chessService.formatAnalysisReport(evaluatedPositions, accuracy);
    } catch (error) {
      console.error('Error durante el análisis de la partida:', error.message);
      throw new Error('Falló el análisis de la partida. Por favor, revisa el PGN y los parámetros.');
    }
  }

  /**
   * Clasifica los movimientos y sugiere las mejores jugadas basándose en el motor.
   * @param positions Las posiciones de la partida.
   * @param depth La profundidad del análisis.
   * @returns Un arreglo de posiciones evaluadas con clasificaciones y sugerencias.
   */
  private async classifyAndSuggest(
    positions: Position[],
    depth: number,
  ): Promise<EvaluatedPosition[]> {
    const evaluatedPositions: EvaluatedPosition[] = [];

    for (const [index, position] of positions.entries()) {
      try {
        // Analizar la posición actual con Stockfish.
        const engineLines = await this.engineService.evaluatePosition(position.fen, depth);

        if (!engineLines || engineLines.length === 0) {
          console.warn(`No se encontraron líneas para la posición: ${position.fen}`);
          continue;
        }

        // Obtener la evaluación principal (mejor línea).
        const bestLine = engineLines[0];

        // Calcular la diferencia de evaluación (delta).
        const evaluationDelta = index > 0 
          ? this.engineService.calculateEvaluationDelta(
              bestLine.evaluation,
              evaluatedPositions[index - 1].evaluation,
            )
          : 0;

        // Clasificar el movimiento según el delta.
        const classification = this.chessService.classifyMove(evaluationDelta);

        // Sugerir el mejor movimiento desde el motor.
        const suggestedMove = {
          san: this.engineService.getSuggestedMove(engineLines),
          uci: this.engineService.getSuggestedMove(engineLines),
        };

        // Construir y almacenar la posición evaluada.
        evaluatedPositions.push({
          ...position,
          evaluation: bestLine.evaluation,
          classification,
          suggestedMove,
        });
      } catch (error) {
        console.error(`Error al analizar la posición ${position.fen}:`, error.message);
        continue;
      }
    }

    return evaluatedPositions;
  }
}
