import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Establece un prefijo global para las rutas
  app.setGlobalPrefix('api');

  // Configuración de CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://chessmaster360.netlify.app', // URL de producción
    ], // Permitir múltiples orígenes
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Métodos HTTP permitidos
    credentials: true, // Permitir envío de cookies si es necesario
  });

  // Inicia el servidor
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
