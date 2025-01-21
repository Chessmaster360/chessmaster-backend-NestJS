import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; 
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';
import { AnalysisService } from './AnalysisService';

@Module({
  imports: [HttpModule], // Para manejar peticiones HTTP a Chess.com
  controllers: [ChessController],
  providers: [ChessService, AnalysisService],
})
export class ChessModule {}
