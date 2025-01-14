import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ChessModule } from './chess/chess.module';
import { BotsModule } from './bots/bots.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // Carga las variables de entorno
    MongooseModule.forRoot(process.env.AZURE_COSMOS_CONNECTIONSTRING, {
      ssl: true, // Importante para Cosmos DB
      retryWrites: false, // Cosmos DB no soporta "retryWrites"
    }),
    UsersModule,
    ChessModule,
    BotsModule, // Módulo de los servicios de ajedrez
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
