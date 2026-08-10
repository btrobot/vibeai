/**
 * Stripe Webhook 集成测试
 * 运行: pnpm build && cd server && node scripts/test-integration.js
 *
 * 覆盖: webhook 端点守卫、错误处理、payment-status 端点
 * Stripe 未配置时验证不依赖外部网络
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

process.env.DATABASE_URL = 'postgresql://vibeai:vibeai123@127.0.0.1:5432/vibeai?sslmode=disable';

describe('Payment Webhook Integration', () => {
  let app: any;
  let request: any;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    // Mimic main.ts rawBody middleware for /api/billing/webhook
    app.use('/api/billing/webhook', (req: any, res: any, next: any) => {
      if (req.rawBody) return next();
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        try {
          req.body = JSON.parse(req.rawBody.toString());
        } catch {
          req.body = {};
        }
        next();
      });
    });
    await app.init();
    request = supertest(app.getHttpServer());
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/billing/payment-status', () => {
    it('should return enabled status', async () => {
      const res = await request.get('/api/billing/payment-status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('enabled');
      expect(typeof res.body.data.enabled).toBe('boolean');
    });

    it('should reflect no Stripe key when env missing', async () => {
      if (process.env.STRIPE_SECRET_KEY) {
        return; // Skip if Stripe is configured
      }
      const res = await request.get('/api/billing/payment-status');
      expect(res.body.data.enabled).toBe(false);
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('should reject without stripe-signature header', async () => {
      const res = await request
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send({ type: 'test.event' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/stripe-signature/i);
    });

    it('should reject empty body even with signature', async () => {
      const res = await request
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'fake-signature')
        .send({});
      // Empty body or invalid signature → 400
      expect([400, 500]).toContain(res.status);
    });

    it('should reject invalid signature', async () => {
      if (process.env.STRIPE_SECRET_KEY) {
        return; // Skip if Stripe is configured; would attempt real validation
      }
      const res = await request
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'invalid-sig-12345')
        .send({ type: 'checkout.session.completed', data: { object: {} } });
      // Without Stripe key OR with invalid sig → 400 / 500
      expect([400, 500]).toContain(res.status);
    });

    it('should reject mismatched content-type', async () => {
      const res = await request
        .post('/api/billing/webhook')
        .set('stripe-signature', 'fake')
        .set('Content-Type', 'text/plain')
        .send('not json');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});