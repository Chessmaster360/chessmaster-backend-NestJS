import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { ChessService } from './chess.service';
import { AnalysisService } from './AnalysisService';


@Controller('chess')
export class ChessController {
  constructor(
    private readonly chessService: ChessService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Get('archives/:username')
  async getPlayerArchives(@Param('username') username: string) {
    return await this.chessService.getPlayerArchives(username);
  }

  @Get('games/:username/:year/:month')
  async getGamesFromMonth(
    @Param('username') username: string,
    @Param('year') year: number,
    @Param('month') month: number,
  ) {
    return await this.chessService.getGamesFromMonth(username, year, month);
  }

  @Get('pgn/:username/:year/:month')
  async getPGN(
    @Param('username') username: string,
    @Param('year') year: number,
    @Param('month') month: number,
  ) {
    return await this.chessService.getPGN(username, year, month);
  }
  @Post('analyze')
  async analyzeGame(@Body() body: { pgn: string; depth: number }) {
    const { pgn, depth } = body;
    return await this.analysisService.analyzeGame(pgn, depth);
  }

}
