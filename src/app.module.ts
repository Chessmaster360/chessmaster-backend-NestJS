import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ChessModule } from './chess/chess.module';
import { EngineService } from 'engine/engine.service';

@Module({
  imports: [
    // ConfigModule cargará la configuración adecuada según NODE_ENV
    ConfigModule.forRoot({
      envFilePath: [
        `.env`, // Archivo genérico
        `src/config/${process.env.MONGO_URI || 'development'}.env`, // Según el entorno
      ],
      isGlobal: true, // Hace accesible la configuración globalmente
    }),
    // Configura Mongoose dinámicamente según la configuración
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI') || configService.get<string>('MONGO_URI'),
        ssl: configService.get<string>('NODE_ENV') === 'production',
        retryWrites: false, // Importante para Cosmos DB
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    ChessModule,
  ],
  controllers: [],
  providers: [EngineService],
})
export class AppModule {}