import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { WsService } from './modules/ws/ws.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.BACKEND_PORT || 3001;

  // Health check endpoint (raw Express route before listen)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await app.listen(port);

  // Initialize WebSocket server on the same HTTP server
  const httpServer = app.getHttpServer();
  const wsService = app.get(WsService);
  wsService.initialize(httpServer);

  console.log(`Backend running on http://localhost:${port}`);
  console.log(`WebSocket server running on ws://localhost:${port}/ws/tasks`);
}
bootstrap();