import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ChessModule } from './chess/chess.module';

@Module({
  imports: [
    // ConfigModule carga el archivo .env desde la raíz del proyecto
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Configura Mongoose dinámicamente según la configuración
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URI');
        console.log('🔍 MONGO_URI loaded =', uri ? 'YES' : 'NO');
        if (uri) {
          console.log('🔍 URI preview =', uri.replace(/:([^:@]+)@/, ':****@'));
        }
        return {
          uri,
          // No especificamos ssl ni retryWrites - MongoDB Atlas lo maneja automáticamente
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    ChessModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }