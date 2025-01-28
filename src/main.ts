import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs-extra';
import { join } from 'path';

async function copyStockfishFiles() {
  try {
    const srcPath = join(__dirname, '..', 'src', 'engine', 'stockfish');
    const destPath = join(__dirname, 'engine', 'stockfish');

    // Verificar si la carpeta de destino existe y contiene archivos
    if (!fs.existsSync(destPath) || (await fs.readdir(destPath)).length === 0) {
      await fs.copy(srcPath, destPath);
      console.log('✅ Archivos de Stockfish copiados exitosamente.');
    } else {
      console.log('⚡ Stockfish ya está copiado, omitiendo...');
    }
  } catch (error) {
    console.error('❌ Error copiando Stockfish:', error);
    process.exit(1); // Detener la ejecución si hay un error crítico
  }
}

async function bootstrap() {
  try {
    // Copiar archivos antes de iniciar la app
    await copyStockfishFiles();

    const app = await NestFactory.create(AppModule);

    // Establece un prefijo global para las rutas
    app.setGlobalPrefix('api');

    // Configuración de CORS
    app.enableCors({
      origin: [
        'http://localhost:5173',
        'https://chessmaster360.netlify.app', // URL de producción
      ],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Inicia el servidor
    const PORT = process.env.PORT ?? 3000;
    await app.listen(PORT);
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  } catch (error) {
    console.error('❌ Error iniciando la aplicación:', error);
    process.exit(1); // Detener la ejecución en caso de fallo crítico
  }
}

bootstrap();
