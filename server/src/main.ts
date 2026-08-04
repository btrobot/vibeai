import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { WsService } from './modules/ws/ws.service';

async function bootstrap() {
  // Run database migrations before starting the app
  try {
    const databaseUrl = process.env.PGDATABASE_URL || process.env.DATABASE_URL;
    if (databaseUrl) {
      const pool = new Pool({ connectionString: databaseUrl });
      await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', 'drizzle') });
      await pool.end();
      console.log('Database migrations completed successfully');
    } else {
      console.log('No database URL found (PGDATABASE_URL / DATABASE_URL), skipping migrations');
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

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;
  const expressApp = app.getHttpAdapter().getInstance();

  // Health check — 注册在 app.init() 之前，确保可被路由匹配
  expressApp.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 显式初始化模块（ServeStaticModule 的中间件在此阶段注册）
  await app.init();

  // SPA fallback — 必须在 app.init() 之后注册，
  // 否则会在 serve-static 之前执行，导致 JS/CSS 等静态资源返回 index.html
  expressApp.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(join(__dirname, '..', '..', 'dist', 'index.html'), (err: any) => {
      if (err) next();
    });
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