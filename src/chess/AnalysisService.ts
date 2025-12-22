import { BadRequestException, Injectable } from '@nestjs/common';
import { ChessService } from './chess.service';
import { EngineService } from '../engine/engine.service';
import { OpeningsService } from './openings.service';
import { Position, EvaluatedPosition, Report, Classification } from '../interfaces/analysis.interfaces';
import { Chess } from 'chess.js';

@Injectable()
export class AnalysisService {

  private chess = new Chess();

  constructor(
    private readonly chessService: ChessService,
    private readonly engineService: EngineService,
    private readonly openingsService: OpeningsService,
  ) { }

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

      // Paso 2: Parsear el PGN a posiciones.
      const positions: Position[] = this.chessService.parsePgn(pgn);
      if (!positions || positions.length === 0) {
        throw new Error('No se encontraron posiciones en el PGN proporcionado.');
      }

      // Paso 3: Analizar cada posición y clasificar movimientos.
      const evaluatedPositions = await this.classifyAndSuggest(positions, depth);

      // Paso 4: Calcular la precisión total.
      const accuracy = this.chessService.calculateAccuracy(
        evaluatedPositions.map((pos) => pos.classification),
      );

      // Paso 5: Generar el reporte final.
      return this.chessService.formatAnalysisReport(evaluatedPositions, accuracy);
    } catch (error) {
      console.error('Error durante el análisis de la partida:', error.message);
      throw new Error('Falló el análisis de la partida. Por favor, revisa el PGN y los parámetros.');
    }
  }

  /**
   * Valida que un PGN sea válido.
   */
  validatePgn(pgn: string): boolean {
    try {
      const testChess = new Chess();
      testChess.loadPgn(pgn);
      if (testChess.history().length === 0) {
        throw new BadRequestException('El PGN proporcionado no contiene movimientos válidos.');
      }
      return true;
    } catch (error) {
      throw new BadRequestException('El PGN proporcionado no es válido: ' + error.message);
    }
  }

  /**
   * Get evaluation value in centipawns (normalized for comparison)
   */
  private getEvalInCentipawns(evaluation: { type: 'cp' | 'mate'; value: number }, isWhiteTurn: boolean): number {
    if (evaluation.type === 'mate') {
      // Mate in N moves: use large value
      const mateValue = evaluation.value > 0 ? 10000 - evaluation.value * 10 : -10000 - evaluation.value * 10;
      return isWhiteTurn ? mateValue : -mateValue;
    }
    // Normalize: positive = good for the player who just moved
    return isWhiteTurn ? evaluation.value : -evaluation.value;
  }

  /**
   * Clasifica los movimientos y sugiere las mejores jugadas basándose en el motor.
   */
  private async classifyAndSuggest(
    positions: Position[],
    depth: number,
  ): Promise<EvaluatedPosition[]> {
    const evaluatedPositions: EvaluatedPosition[] = [];

    for (const [index, position] of positions.entries()) {
      try {
        // Check if this is a book move (opening position)
        const openingName = this.openingsService.getOpeningName(position.fen);
        const isBookMove = openingName !== null || this.openingsService.isOpeningPhase(index + 1);

        // For very early moves (first 5), just mark as book if in opening database
        if (index < 10 && openingName !== null) {
          evaluatedPositions.push({
            ...position,
            evaluation: { type: 'cp', value: 0 },
            classification: 'book',
            suggestedMove: { san: '', uci: '' },
          });
          continue;
        }

        const engineLines = await this.engineService.evaluatePosition(position.fen, depth);

        // Handle case when no lines returned
        if (!engineLines || engineLines.length === 0) {
          console.warn(`No se encontraron líneas para la posición: ${position.fen}`);
          evaluatedPositions.push({
            ...position,
            evaluation: { type: 'cp', value: 0 },
            classification: isBookMove ? 'book' : 'excellent',
            suggestedMove: { san: '', uci: '' },
          });
          continue;
        }

        const bestLine = engineLines[0];
        const isWhiteTurn = index % 2 === 0; // White plays on even indices (0, 2, 4...)

        // Get current position evaluation
        const currentEval = this.getEvalInCentipawns(bestLine.evaluation, isWhiteTurn);

        // Get previous position evaluation
        let previousEval = 0;
        let evaluationDelta = 0;

        if (index > 0 && evaluatedPositions[index - 1]?.evaluation) {
          const prevEvalRaw = evaluatedPositions[index - 1].evaluation;
          previousEval = this.getEvalInCentipawns(prevEvalRaw, !isWhiteTurn);

          // Delta: how much the position changed
          // Positive delta = position got worse for the moving player
          // Negative delta = position got better for the moving player
          evaluationDelta = previousEval - currentEval;
        }

        // Check if the played move matches the engine's suggested best move
        const isBestMove = bestLine.moveUCI && position.move?.uci === bestLine.moveUCI;

        // Classify the move
        let classification: Classification;

        if (isBookMove && openingName !== null) {
          classification = 'book';
        } else {
          classification = this.chessService.classifyMove(
            evaluationDelta,
            previousEval,
            currentEval,
            isBestMove
          );
        }

        // Get suggested move
        let suggestedMove = { san: '', uci: '' };
        try {
          if (bestLine.moveUCI) {
            suggestedMove = this.engineService.getSuggestedMove(engineLines, position.fen);
          }
        } catch {
          // Terminal position or no valid moves
        }

        evaluatedPositions.push({
          ...position,
          evaluation: bestLine.evaluation,
          classification,
          suggestedMove
        });
      } catch (error) {
        console.error(`Error al analizar la posición ${position.fen}:`, error.message);
        evaluatedPositions.push({
          ...position,
          evaluation: { type: 'cp', value: 0 },
          classification: 'excellent', // Default to excellent instead of book
          suggestedMove: { san: '', uci: '' },
        });
      }
    }

    return evaluatedPositions;
  }
}
