import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { Chess } from 'chess.js'; // Usamos chess.js para manejar la lógica de ajedrez.
import { Position, Classification, EvaluatedPosition, Report } from '../interfaces/analysis.interfaces';

// Define los tipos de datos esperados en las respuestas
interface ArchivesResponse {
  archives: string[];
}

interface GamesResponse {
  games: string[]; // Cambia `any` por el tipo específico si sabes la estructura de los datos
}

@Injectable()
export class ChessService {

  private chess = new (Chess as any)();

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async getPlayerArchives(username: string): Promise<string[]> {
    const url = `https://api.chess.com/pub/player/${username}/games/archives`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<ArchivesResponse>(url),
      );
      return response.data.archives; // Retorna las URLs de los archivos mensuales
    } catch (error) {
      throw new NotFoundException('No se pudieron obtener los archivos del jugador.');
    }
  }

  async getGamesFromMonth(username: string, year: number, month: number): Promise<any[]> {
    const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month.toString().padStart(2, '0')}`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<GamesResponse>(url),
      );
      return response.data.games; // Lista de partidas en formato JSON
    } catch (error) {
      throw new NotFoundException('No se pudieron obtener las partidas para el mes especificado.');
    }
  }

  async getPGN(username: string, year: number, month: number): Promise<string> {
    const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month.toString().padStart(2, '0')}/pgn`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<string>(url),
      );
      return response.data; // Retorna el archivo PGN completo
    } catch (error) {
      throw new NotFoundException('No se pudo obtener el archivo PGN.');
    }
  }
  
   /**
   * Convierte un PGN en una lista de posiciones.
   * @param pgn El PGN de la partida.
   * @returns Un arreglo de objetos `Position` con FEN y detalles de movimiento.
   */
   parsePgn(pgn: string): Position[] {
    this.chess.loadPgn(pgn); // Cargar el PGN en el tablero.

    const positions: Position[] = [];
    const history = this.chess.history({ verbose: true }); // Obtener la historia detallada.

    this.chess.reset(); // Resetear para volver al inicio.

    for (const move of history) {
      // Hacer el movimiento y capturar el FEN.
      this.chess.move(move.san);
      positions.push({
        fen: this.chess.fen(),
        move: {
          san: move.san,
          uci: move.from + move.to + (move.promotion || ''), // Formato UCI.
        },
      });
    }

    return positions;
  }

  /**
   * Clasifica un movimiento basado en el delta de evaluación.
   * @param evaluationDelta La diferencia de evaluación del movimiento.
   * @returns La clasificación del movimiento como `Classification`.
   */
  classifyMove(evaluationDelta: number): Classification {
    if (evaluationDelta === 0) return 'best';
    if (evaluationDelta > 0 && evaluationDelta <= 50) return 'excellent';
    if (evaluationDelta > 50 && evaluationDelta <= 150) return 'good';
    if (evaluationDelta > 150 && evaluationDelta <= 300) return 'inaccuracy';
    if (evaluationDelta > 300 && evaluationDelta <= 700) return 'mistake';
    if (evaluationDelta > 700) return 'blunder';
    if (evaluationDelta < 0 && Math.abs(evaluationDelta) <= 50) return 'forced';
    return 'book'; // Movimiento en apertura.
  }

  /**
   * Calcula la precisión de los jugadores en la partida.
   * @param classifications Clasificaciones de los movimientos en la partida.
   * @returns Un número entre 1 y 100 que representa la precisión.
   */
  calculateAccuracy(classifications: Classification[]): number {
    const classificationWeights: Record<Classification, number> = {
      brilliant: 1.0,
      great: 0.9,
      best: 0.8,
      excellent: 0.7,
      good: 0.6,
      inaccuracy: 0.4,
      mistake: 0.2,
      blunder: 0.0,
      book: 0.8,
      forced: 0.8,
    };

    const totalWeight = classifications.reduce(
      (acc, classification) => acc + (classificationWeights[classification] || 0),
      0,
    );

    return Math.round((totalWeight / classifications.length) * 100);
  }

  public formatAnalysisReport(evaluatedPositions: EvaluatedPosition[], accuracy: number): Report {
    // Inicializar contadores para clasificaciones
    const whiteClassifications: Record<Classification, number> = {
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      inaccuracy: 0, mistake: 0, blunder: 0, book: 0, forced: 0
    };
    const blackClassifications: Record<Classification, number> = {
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      inaccuracy: 0, mistake: 0, blunder: 0, book: 0, forced: 0
    };

    // Separar posiciones por color y contar clasificaciones
    evaluatedPositions.forEach((pos, index) => {
      const isWhite = index % 2 === 0;
      if (isWhite) {
        whiteClassifications[pos.classification]++;
      } else {
        blackClassifications[pos.classification]++;
      }
    });

    // Calcular precisión por color
    const whitePositions = evaluatedPositions.filter((_, i) => i % 2 === 0);
    const blackPositions = evaluatedPositions.filter((_, i) => i % 2 === 1);

    const whiteAccuracy = this.calculateAccuracy(whitePositions.map(pos => pos.classification));
    const blackAccuracy = this.calculateAccuracy(blackPositions.map(pos => pos.classification));

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
