import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

// Define los tipos de datos esperados en las respuestas
interface ArchivesResponse {
  archives: string[];
}

interface GamesResponse {
  games: string[]; // Cambia `any` por el tipo específico si sabes la estructura de los datos
}

@Injectable()
export class ChessService {
  constructor(private readonly httpService: HttpService) {}

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
}
