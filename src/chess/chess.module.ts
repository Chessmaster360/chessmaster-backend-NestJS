import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChessService } from './chess.service';
import { ChessController } from './chess.controller';
import { AnalysisService } from './AnalysisService';
import { OpeningsService } from './openings.service';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [
    HttpModule,
    EngineModule,
  ],
  controllers: [ChessController],
  providers: [ChessService, AnalysisService, OpeningsService],
})
export class ChessModule { }

