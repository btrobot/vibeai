import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { WsService } from './modules/ws/ws.service';

async function bootstrap() {
  // Run database migrations before starting the app
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      const pool = new Pool({ connectionString: databaseUrl });
      await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
      await pool.end();
      console.log('Database migrations completed successfully');
    } else {
      console.log('DATABASE_URL not set, skipping migrations');
    }
  } catch (e) {
    console.error('Migration failed:', (e as Error).message);
    // Don't exit - allow app to start even if migration fails (dev mode)
  }

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

  // SPA fallback: serve index.html for non-API, non-WebSocket routes
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    // If serve-static didn't find the file, serve index.html as SPA fallback
    res.sendFile(join(__dirname, '..', '..', 'dist', 'index.html'), (err: any) => {
      if (err) res.status(500).send('Internal Server Error');
    });
  });

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;

  // Health check endpoint
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