import { BadRequestException, Injectable } from '@nestjs/common';
import { ChessService } from './chess.service';
import { EngineService } from '../engine/engine.service';
import { Position, EvaluatedPosition, Report } from '../interfaces/analysis.interfaces';
import { Chess, validateFen } from 'chess.js';

@Injectable()
export class AnalysisService {
  
  private chess = new Chess();
  
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


      // Paso 1: Validar el PGN
      this.validatePgn(pgn);

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
   * Valida que un PGN sea válido.
   * @param pgn El PGN a validar.
   * @returns `true` si el PGN es válido, de lo contrario lanza una excepción.
   */
  validatePgn(pgn: string): boolean {
    const isValid = validateFen(pgn).ok;
    if (!isValid) {
      throw new BadRequestException('El PGN proporcionado no es válido.');
    }
    return true;
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
        const engineLines = await this.engineService.evaluatePosition(position.fen, depth);

        if (!engineLines || engineLines.length === 0) {
          console.warn(`No se encontraron líneas para la posición: ${position.fen}`);
          continue;
        }

        const bestLine = engineLines[0];
        const evaluationDelta = index > 0 
          ? this.engineService.calculateEvaluationDelta(
              bestLine.evaluation,
              evaluatedPositions[index - 1].evaluation,
            )
          : 0;

        const classification = this.chessService.classifyMove(evaluationDelta);
        const suggestedMove = this.engineService.getSuggestedMove(engineLines, position.fen);

        evaluatedPositions.push({
          ...position,
          evaluation: bestLine.evaluation,
          classification,
          suggestedMove
        });
      } catch (error) {
        console.error(`Error al analizar la posición ${position.fen}:`, error.message);
        continue;
      }
    }

    return evaluatedPositions;
  }
}
