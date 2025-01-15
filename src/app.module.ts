import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ChessModule } from './chess/chess.module';
import { BotsModule } from './bots/bots.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // Carga las variables de entorno
    MongooseModule.forRoot(process.env.MONGO_URI, {
      dbName: 'chessmaster', // Nombre de la base de datos
    }),
    UsersModule,
    ChessModule,
    BotsModule, // Módulo de los servicios de ajedrez
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
