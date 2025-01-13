import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
   // Establece un prefijo global para las rutas
   app.setGlobalPrefix('api');

   // Configuración de CORS
    app.enableCors({
      origin: 'http://localhost:5173', // Origen permitido
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Métodos HTTP permitidos
      credentials: true, // Habilitar envío de cookies si es necesario
    });


   // Inicia el servidor
   await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
