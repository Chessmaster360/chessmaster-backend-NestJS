import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
   // Establece un prefijo global para las rutas
   app.setGlobalPrefix('api');

   // Inicia el servidor
   await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
