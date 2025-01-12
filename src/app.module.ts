import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // Carga las variables de entorno
    MongooseModule.forRoot(process.env.MONGO_URI, {
      dbName: 'chessmaster', // Nombre de la base de datos
    }),
    UsersModule, // Módulo de los servicios de ajedrez
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
