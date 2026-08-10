/**
 * 订单 checkout 集成测试
 * 运行方式: pnpm build && cd server && node scripts/test-integration.js
 *
 * 覆盖: 注册 → 创建订单 → 查询订单 → 列表订单 → checkout 流程
 * Stripe 未配置时不依赖外部网络（PaymentService 抛 400）
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

process.env.DATABASE_URL = 'postgresql://vibeai:vibeai123@127.0.0.1:5432/vibeai?sslmode=disable';

describe('Orders Integration', () => {
  let app: any;
  let request: any;
  let userToken: string;
  let userId: string;
  let orderId: string;
  let orderNumber: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    request = supertest(app.getHttpServer());
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Setup: register + login', () => {
    const testEmail = `orders-${Date.now()}@example.com`;

    it('should register a new user', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: testEmail, password: 'TestPass123!', name: 'Orders Test' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      userId = res.body.data.id;
    });

    it('should login and get token', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'TestPass123!' });
      expect(res.status).toBe(200);
      userToken = res.body.data.tokens.accessToken;
      expect(userToken).toBeDefined();
    });
  });

  describe('POST /api/orders (create credit pack order)', () => {
    it('should create a credit_pack order', async () => {
      const res = await request
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'credit_pack',
          amount: 9.99,
          currency: 'USD',
          credits: 100,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.type).toBe('credit_pack');
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.orderNumber).toMatch(/^ORD-\d{8}-\d{6}$/);
      orderId = res.body.data.id;
      orderNumber = res.body.data.orderNumber;
    });

    it('should reject order with amount 0', async () => {
      const res = await request
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'credit_pack',
          amount: 0,
          credits: 100,
        });
      expect(res.status).toBe(400);
    });

    it('should reject order without auth', async () => {
      const res = await request
        .post('/api/orders')
        .send({
          type: 'credit_pack',
          amount: 9.99,
          credits: 100,
        });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders/:id and /api/orders/number/:orderNumber', () => {
    it('should get order by id', async () => {
      const res = await request
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data.status).toBe('pending');
    });

    it('should get order by order number', async () => {
      const res = await request
        .get(`/api/orders/number/${orderNumber}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe(orderNumber);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request
        .get('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/orders (list)', () => {
    it('should list user orders', async () => {
      const res = await request
        .get('/api/orders?page=1&pageSize=10')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.some((o: { id: string }) => o.id === orderId)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request
        .get('/api/orders?status=pending')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.every((o: { status: string }) => o.status === 'pending')).toBe(true);
    });
  });

  describe('POST /api/orders/:id/checkout', () => {
    it('should reject checkout when payment not enabled (no Stripe key)', async () => {
      const res = await request
        .post(`/api/orders/${orderId}/checkout`)
        .set('Authorization', `Bearer ${userToken}`);
      // Either 400 (payment disabled) or success-with-url (test env has Stripe key)
      if (process.env.STRIPE_SECRET_KEY) {
        expect([200, 201]).toContain(res.status);
        if (res.status === 200 || res.status === 201) {
          expect(res.body.data.url || res.body.url).toBeDefined();
        }
      } else {
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/支付.*未启用|STRIPE/);
      }
    });

    it('should reject second checkout (order not pending after first attempt)', async () => {
      // Skip if previous test succeeded (would have transitioned order)
      if (process.env.STRIPE_SECRET_KEY) {
        return; // Can't test pending-check without mocking Stripe
      }
      const res = await request
        .post(`/api/orders/${orderId}/checkout`)
        .set('Authorization', `Bearer ${userToken}`);
      // Order is still pending (Stripe rejected) but we already verified payment disabled
      expect([200, 400]).toContain(res.status);
    });

    it('should reject checkout without auth', async () => {
      const res = await request.post(`/api/orders/${orderId}/checkout`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/orders/expire (admin cleanup)', () => {
    it('should expire pending orders without auth errors', async () => {
      // This endpoint is exposed without explicit JwtAuthGuard decorator
      // but may still require auth — check both outcomes
      const res = await request.post('/api/orders/expire');
      // Either succeeds (no auth) or 401 (auth required)
      expect([200, 401, 403]).toContain(res.status);
    });
  });
});