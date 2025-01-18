import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; 
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';
import { StockfishService } from './stockfish.service';

@Module({
  imports: [HttpModule], // Para manejar peticiones HTTP a Chess.com
  controllers: [ChessController],
  providers: [ChessService, StockfishService],
})
export class ChessModule {}
