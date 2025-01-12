import { Module } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';

@Module({
  imports: [HttpService], // Para manejar peticiones HTTP a Chess.com
  controllers: [ChessController],
  providers: [ChessService],
})
export class ChessModule {}
