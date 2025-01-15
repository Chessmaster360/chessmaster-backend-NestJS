import { Module } from '@nestjs/common';
import { ControllerModule } from './controller/controller.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [ControllerModule, ServicesModule]
})
export class BotsModule {}
