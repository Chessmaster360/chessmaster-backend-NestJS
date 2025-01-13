import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // Importa el HttpModule
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';

@Module({
  imports: [HttpModule], // Para manejar peticiones HTTP a Chess.com
  controllers: [ChessController],
  providers: [ChessService],
})
export class ChessModule {}
