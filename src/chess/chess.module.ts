import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';
import { AnalysisService } from './AnalysisService';
import { EngineModule } from '../engine/engine.module'; // Importa el EngineModule

@Module({
  imports: [
    HttpModule, // Para manejar peticiones HTTP a Chess.com
    EngineModule, // Asegúrate de que EngineService esté disponible
  ],
  controllers: [ChessController],
  providers: [ChessService, AnalysisService],
})
export class ChessModule {}
