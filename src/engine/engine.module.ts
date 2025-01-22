import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';

@Module({
  providers: [EngineService],
  exports: [EngineService], // Exportamos el servicio para otros módulos
})
export class EngineModule {}
