import { BadRequestException, Injectable } from '@nestjs/common';
import { ChessService } from './chess.service';
import { EngineService } from '../engine/engine.service';
import { OpeningsService } from './openings.service';
import { Position, EvaluatedPosition, Report, Classification } from '../interfaces/analysis.interfaces';
import { Chess } from 'chess.js';
import { EvaluationUtils } from './evaluation.util';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly chessService: ChessService,
    private readonly engineService: EngineService,
    private readonly openingsService: OpeningsService,
  ) { }

  async analyzeGame(pgn: string, depth: number): Promise<Report> {
    this.validatePgn(pgn);
    const positions = this.chessService.parsePgn(pgn);

    const whiteAccuracies: number[] = [];
    const blackAccuracies: number[] = [];
    const evaluatedPositions: EvaluatedPosition[] = [];

    const tempChess = new Chess();
    let previousFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    for (const [index, position] of positions.entries()) {
      tempChess.load(previousFen);
      const isWhiteTurn = tempChess.turn() === 'w';

      // 1. Detección de Libro (Solo para primeros movimientos en base de datos)
      const openingName = this.openingsService.getOpeningName(previousFen);
      if (openingName && index < 20) {
        evaluatedPositions.push({
          ...position,
          evaluation: { type: 'cp', value: 0 },
          classification: 'book',
          suggestedMove: { san: '', uci: '' }
        });
        if (isWhiteTurn) whiteAccuracies.push(100);
        else blackAccuracies.push(100);
        previousFen = position.fen;
        continue;
      }

      // 2. Evaluar la posición ANTERIOR para saber cuál era el mejor movimiento
      const engineResult = await this.engineService.evaluatePosition(previousFen, depth);

      if (!engineResult || engineResult.length === 0) {
        evaluatedPositions.push({
          ...position,
          evaluation: { type: 'cp', value: 0 },
          classification: 'forced',
          suggestedMove: { san: '', uci: '' }
        });
        previousFen = position.fen;
        continue;
      }

      const bestLine = engineResult[0];
      const bestMoveUci = bestLine.moveUCI;
      const userMoveUci = position.move.uci;

      // Convert best move UCI to SAN for display (with error handling)
      const bestMoveSan = this.uciToSan(previousFen, bestMoveUci);

      // Normalizar UCIs para comparación (eliminar promociones vacías, lowercase)
      const normalizeUci = (uci: string) => uci.toLowerCase().replace(/undefined|null/g, '');
      const isBestMove = normalizeUci(userMoveUci) === normalizeUci(bestMoveUci);

      // ============================================================
      // EVALUATION PERSPECTIVE - CRITICAL UNDERSTANDING
      // ============================================================
      // Stockfish ALWAYS returns evaluation from the perspective of the
      // side TO MOVE in the given FEN position.
      // 
      // When we evaluate previousFen (before the move):
      // - If it's White's turn, eval is from White's perspective
      // - If it's Black's turn, eval is from Black's perspective
      // 
      // We want all evaluations in WHITE's perspective for consistency.
      // ============================================================

      // Best eval is from previousFen, which has the current player to move
      // Convert to WHITE's perspective
      const bestEvalFromEngine = this.evalToCP(bestLine.evaluation);
      const bestEvalWhitePerspective = isWhiteTurn ? bestEvalFromEngine : -bestEvalFromEngine;

      // 3. Si NO es la mejor jugada, evaluar la posición resultante
      let userEvalWhitePerspective = bestEvalWhitePerspective;

      if (!isBestMove) {
        // Evaluar la posición después del movimiento del usuario (position.fen)
        // In position.fen, it's the OPPONENT's turn to move
        const userPosEval = await this.engineService.evaluatePosition(position.fen, Math.min(depth, 12));

        if (userPosEval && userPosEval.length > 0) {
          // The eval is from the OPPONENT's perspective (next player to move)
          // So we need to negate it to get WHITE's perspective
          const evalFromOpponentPerspective = this.evalToCP(userPosEval[0].evaluation);
          // After White moves, it's Black's turn - so eval is from Black's perspective -> negate for White
          // After Black moves, it's White's turn - so eval is from White's perspective -> keep as is
          userEvalWhitePerspective = isWhiteTurn ? -evalFromOpponentPerspective : evalFromOpponentPerspective;
        } else {
          // Si no hay evaluación (mate, etc), asumimos pérdida grande
          userEvalWhitePerspective = isWhiteTurn ? -3000 : 3000;
        }
      }

      // 4. Calcular pérdida en centipawns
      // Both evaluations are now in WHITE's perspective
      // For White: higher = better, so loss = best - user (if positive, it's a loss)
      // For Black: lower = better, so loss = user - best (if positive, it's a loss for Black)
      let cpLoss: number;
      if (isWhiteTurn) {
        cpLoss = bestEvalWhitePerspective - userEvalWhitePerspective;
      } else {
        // For Black: they want LOWER values (more negative from White's perspective)
        // So a loss is when user's eval is HIGHER (less negative) than best eval
        cpLoss = userEvalWhitePerspective - bestEvalWhitePerspective;
      }

      // Loss should never be negative (user can't play better than engine's best)
      cpLoss = Math.max(0, cpLoss);

      // Debug
      console.log(`[Move ${index + 1}] ${position.move.san} | isWhite: ${isWhiteTurn} | Best: ${bestMoveUci} | User: ${userMoveUci} | isBest: ${isBestMove} | BestEval(W): ${bestEvalWhitePerspective}cp | UserEval(W): ${userEvalWhitePerspective}cp | Loss: ${cpLoss}cp`);

      // 5. Calcular precisión del movimiento
      const probabilityLoss = EvaluationUtils.getProbabilityLoss(bestEvalWhitePerspective, userEvalWhitePerspective, isWhiteTurn);
      const moveAccuracy = EvaluationUtils.getMoveAccuracy(probabilityLoss);

      if (isWhiteTurn) whiteAccuracies.push(moveAccuracy);
      else blackAccuracies.push(moveAccuracy);

      // 6. Clasificar el movimiento
      let classification = this.chessService.classifyMove(cpLoss, isBestMove);

      // 7. Lógica de "Brillante" (Best + Sacrificio + No estaba ganado)
      if (classification === 'best') {
        const isMaterialDown = this.hasMaterialSacrifice(previousFen, position.fen, isWhiteTurn);
        if (isMaterialDown && Math.abs(bestEvalWhitePerspective) < 500) {
          classification = 'brilliant';
        }
      }

      // 8. Guardar resultado
      evaluatedPositions.push({
        ...position,
        evaluation: bestLine.evaluation,
        classification: classification,
        suggestedMove: { san: bestMoveSan, uci: bestMoveUci }
      });

      previousFen = position.fen;
    }

    // 9. Generar Reporte Final
    const whiteGameAccuracy = this.chessService.calculateGameAccuracy(whiteAccuracies);
    const blackGameAccuracy = this.chessService.calculateGameAccuracy(blackAccuracies);

    return this.chessService.formatAnalysisReport(
      evaluatedPositions,
      whiteGameAccuracy,
      blackGameAccuracy
    );
  }

  /**
   * Converts evaluation object to centipawns (from side-to-move perspective)
   */
  private evalToCP(evalObj: { type: 'cp' | 'mate'; value: number }): number {
    if (evalObj.type === 'mate') {
      const sign = Math.sign(evalObj.value);
      // Mate in 1 (10000) > Mate in 5 (9900)
      return sign * (10000 - Math.abs(evalObj.value) * 20);
    }
    return evalObj.value;
  }

  /**
   * Detecta si hubo sacrificio de material
   */
  private hasMaterialSacrifice(prevFen: string, currFen: string, isWhiteTurn: boolean): boolean {
    const prevMat = this.getMaterialCount(prevFen);
    const currMat = this.getMaterialCount(currFen);

    if (isWhiteTurn) {
      return currMat.white < prevMat.white;
    } else {
      return currMat.black < prevMat.black;
    }
  }

  /**
   * Cuenta material por color
   */
  private getMaterialCount(fen: string) {
    const pieces = fen.split(' ')[0];
    let white = 0, black = 0;
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    for (const char of pieces) {
      const lower = char.toLowerCase();
      if (values[lower] !== undefined) {
        const val = values[lower];
        if (char === char.toUpperCase()) white += val;
        else black += val;
      }
    }
    return { white, black };
  }

  validatePgn(pgn: string): boolean {
    try {
      const tempChess = new Chess();
      tempChess.loadPgn(pgn);
      if (tempChess.history().length === 0) throw new Error();
      return true;
    } catch {
      throw new BadRequestException('PGN inválido o sin movimientos.');
    }
  }

  /**
   * Converts UCI notation to SAN notation
   */
  private uciToSan(fen: string, uci: string): string {
    if (!uci || uci.length < 4) return '';

    try {
      const tempChess = new Chess(fen);
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;

      const move = tempChess.move({ from, to, promotion });
      return move ? move.san : '';
    } catch (e) {
      console.error(`Error converting UCI to SAN: ${uci}`, e);
      return uci; // Return UCI as fallback instead of empty string
    }
  }
}