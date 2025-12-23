import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { Chess } from 'chess.js';
import { Position, Classification, EvaluatedPosition, Report } from '../interfaces/analysis.interfaces';
import { EvaluationUtils } from './evaluation.util';

interface ArchivesResponse {
  archives: string[];
}

interface GamesResponse {
  games: string[];
}

@Injectable()
export class ChessService {

  private chess = new (Chess as any)();

  constructor(
    private readonly httpService: HttpService,
  ) { }

  async getPlayerArchives(username: string): Promise<string[]> {
    const url = `https://api.chess.com/pub/player/${username}/games/archives`;
    try {
      const response = await lastValueFrom(this.httpService.get<ArchivesResponse>(url));
      return response.data.archives;
    } catch (error) {
      throw new NotFoundException('No se pudieron obtener los archivos del jugador.');
    }
  }

  async getGamesFromMonth(username: string, year: number, month: number): Promise<any[]> {
    const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month.toString().padStart(2, '0')}`;
    try {
      const response = await lastValueFrom(this.httpService.get<GamesResponse>(url));
      return response.data.games;
    } catch (error) {
      throw new NotFoundException('No se pudieron obtener las partidas para el mes especificado.');
    }
  }

  async getPGN(username: string, year: number, month: number): Promise<string> {
    const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month.toString().padStart(2, '0')}/pgn`;
    try {
      const response = await lastValueFrom(this.httpService.get<string>(url));
      return response.data;
    } catch (error) {
      throw new NotFoundException('No se pudo obtener el archivo PGN.');
    }
  }

  parsePgn(pgn: string): Position[] {
    this.chess.loadPgn(pgn);
    const positions: Position[] = [];
    const history = this.chess.history({ verbose: true });
    this.chess.reset();

    for (const move of history) {
      this.chess.move(move.san);
      positions.push({
        fen: this.chess.fen(),
        move: {
          san: move.san,
          uci: move.from + move.to + (move.promotion || ''),
        },
      });
    }
    return positions;
  }

  /**
   * Clasifica el movimiento basado en la pérdida de Centipawns.
   * 
   * @param cpLoss - Pérdida en centipawns (siempre >= 0, calculado afuera)
   * @param isBestMove - Si el movimiento jugado coincide con el mejor del motor
   */
  classifyMove(cpLoss: number, isBestMove: boolean): Classification {
    // Si el jugador jugó exactamente la mejor jugada
    if (isBestMove) return 'best';

    // Debug logging
    console.log(`[ClassifyMove] cpLoss: ${cpLoss}, isBest: ${isBestMove}`);

    // Clasificación basada en pérdida de centipawns (CP)
    // Estos umbrales son más claros y fáciles de debuggear
    if (cpLoss <= 10) return 'excellent';      // Casi perfecto
    if (cpLoss <= 25) return 'good';           // Pequeña pérdida
    if (cpLoss <= 50) return 'inaccuracy';     // Pérdida notable
    if (cpLoss <= 100) return 'inaccuracy';    // Imprecisión clara
    if (cpLoss <= 200) return 'mistake';       // Error significativo
    if (cpLoss <= 350) return 'mistake';       // Error grave
    return 'blunder';                          // Error crítico (>350cp)
  }

  /**
   * Calcula el promedio de precisión basado en el array de precisiones individuales
   */
  calculateGameAccuracy(accuracies: number[]): number {
    if (accuracies.length === 0) return 0;
    const sum = accuracies.reduce((a, b) => a + b, 0);
    return Math.round((sum / accuracies.length) * 10) / 10;
  }

  /**
   * Formatea el reporte final con las clasificaciones y precisiones ya calculadas.
   */
  formatAnalysisReport(
    evaluatedPositions: EvaluatedPosition[],
    whiteAccuracy: number,
    blackAccuracy: number
  ): Report {
    // Contar clasificaciones para cada color
    const whiteClassifications: Record<Classification, number> = {
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      inaccuracy: 0, mistake: 0, blunder: 0, book: 0, forced: 0, miss: 0
    };
    const blackClassifications: Record<Classification, number> = {
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      inaccuracy: 0, mistake: 0, blunder: 0, book: 0, forced: 0, miss: 0
    };

    evaluatedPositions.forEach((pos, i) => {
      const isWhite = i % 2 === 0;
      if (isWhite) whiteClassifications[pos.classification]++;
      else blackClassifications[pos.classification]++;
    });

    return {
      positions: evaluatedPositions,
      accuracies: {
        white: whiteAccuracy,
        black: blackAccuracy
      },
      classifications: {
        white: whiteClassifications,
        black: blackClassifications
      }
    };
  }
}