import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // Carga las variables de entorno
    MongooseModule.forRoot(process.env.MONGO_URI, {
      authSource: 'chessmaster',  // Asegúrate de usar la base de datos correcta para la autenticación
    }),
    UsersModule, // Módulo de los servicios de ajedrez
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
