import 'reflect-metadata';
import { config } from 'dotenv';
import path from 'path';

// 加载 .env.local（宿主机部署）> .env（本地开发）
config({ path: path.resolve(__dirname, '..', '.env.local'), override: false });
config({ path: path.resolve(__dirname, '..', '.env'), override: false });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { assertJwtSecretConfigured } from './common/jwt-secret';
import { resolveCorsOrigin } from './common/cors.config';
import { HealthService } from './common/health.service';
import { WsService } from './modules/ws/ws.service';
// WsService token is 'WS_SERVICE'


async function bootstrap() {
  // 安全校验：生产环境 JWT_SECRET 缺失或为弱密钥时 fail-fast
  assertJwtSecretConfigured();
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

  // Stripe webhook needs raw body — register before other middleware
  // Only applies to the webhook endpoint
  app.use('/api/billing/webhook', (req: any, res: any, next: any) => {
    // NestJS by default parses JSON. For webhook, we need the raw body.
    // We store it on req.rawBody if available from the body parser.
    if (req.rawBody) {
      next();
    } else {
      // Fallback: collect raw chunks
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        // Re-parse as JSON for NestJS body parsing
        try {
          req.body = JSON.parse(req.rawBody.toString());
        } catch {
          req.body = {};
        }
        next();
      });
    }
  });
  app.enableCors({
    origin: resolveCorsOrigin(),
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
  // 基础健康检查（无需 DI），用于 Docker HEALTHCHECK 和负载均衡器探活
  expressApp.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Deep health check — 需要 DI，但必须在 app.init() 之前注册路由
  // HealthService 在请求到来时已经可用（app.init() 已完成）
  expressApp.get('/api/health/deep', async (_req: any, res: any) => {
    try {
      const healthService = app.get(HealthService);
      const result = await healthService.checkHealth();
      const statusCode = result.status === 'ok' ? 200 : result.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(result);
    } catch (err) {
      res.status(503).json({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: (err as Error).message,
      });
    }
  });

  // Swagger / OpenAPI documentation — 必须在 app.init() 之前注册
  // 否则 NestJS 路由器会拦截 /api/docs 返回 404
  const swaggerConfig = new DocumentBuilder()
    .setTitle('VibeAI API')
    .setDescription('AI 视频/图片生成 + 电商内容工具 + 后台管理平台 API 文档')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('auth', '认证与用户管理')
    .addTag('billing', '计费与订阅')
    .addTag('payments', '支付与订单')
    .addTag('orders', '订单管理')
    .addTag('gateway', 'AI 能力与生成')
    .addTag('storage', '文件存储')
    .addTag('gallery', '画廊与社区')
    .addTag('project', '项目管理')
    .addTag('task', '任务管理')
    .addTag('create', '创作管理')
    .addTag('user', '用户信息')
    .addTag('admin', '管理后台')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  console.log(`Swagger UI available at http://localhost:${port}/api/docs`);

  // 显式初始化模块（ServeStaticModule 的中间件在此阶段注册）
  await app.init();

  // Seed AI models (moved from GatewayModule.onModuleInit to avoid DI issues with tsx)
  try {
    const gatewayService = app.get('GATEWAY_SERVICE') as any;
    await gatewayService.seedModels();
  } catch (e) {
    console.error('Seed models failed:', (e as Error).message);
  }

  // SPA fallback — 必须在 app.init() 之后注册，
  // 否则会在 serve-static 之前执行，导致 JS/CSS 等静态资源返回 index.html

  expressApp.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(join(__dirname, '..', '..', 'dist', 'index.html'), (err: any) => {
      if (err) next();
    });
  });

  await app.listen(port);

  // Graceful shutdown
  app.enableShutdownHooks();

  // Initialize WebSocket server on the same HTTP server
  const httpServer = app.getHttpServer();
  const wsService = app.get('WS_SERVICE') as any;
  wsService.initialize(httpServer);

  console.log(`Backend running on http://localhost:${port}`);
  console.log(`WebSocket server running on ws://localhost:${port}/ws/tasks`);
}
bootstrap();