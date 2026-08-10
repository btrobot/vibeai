/**
 * Admin 电商管理集成测试
 * 运行: pnpm build && cd server && node scripts/test-integration.js
 *
 * 覆盖：AdminGuard 守卫 + 订单/商品/促销码 CRUD 端到端
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

process.env.DATABASE_URL = 'postgresql://vibeai:vibeai123@127.0.0.1:5432/vibeai?sslmode=disable';

describe('Admin Commerce Integration', () => {
  let app: any;
  let request: any;
  let adminToken: string;
  let userToken: string;
  let productId: string;
  let promoId: string;

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

  describe('Setup: login admin + register non-admin', () => {
    it('admin login', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      expect(res.status).toBe(200);
      adminToken = res.body.data.tokens.accessToken;
    });

    it('register non-admin user', async () => {
      const email = `nonadmin-${Date.now()}@example.com`;
      const res = await request
        .post('/api/auth/register')
        .send({ email, password: 'TestPass123!', name: 'NonAdmin' });
      expect(res.status).toBe(201);

      const loginRes = await request
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });
      expect(loginRes.status).toBe(200);
      userToken = loginRes.body.data.tokens.accessToken;
    });
  });

  describe('AdminGuard', () => {
    it('non-admin user should be rejected (403) by /api/admin/orders', async () => {
      const res = await request
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('non-admin user should be rejected (403) by /api/admin/commerce/products', async () => {
      const res = await request
        .get('/api/admin/commerce/products')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('non-admin user should be rejected (403) by /api/admin/commerce/promo-codes', async () => {
      const res = await request
        .get('/api/admin/commerce/promo-codes')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('no auth should be rejected (401)', async () => {
      const res = await request.get('/api/admin/orders');
      expect(res.status).toBe(401);
    });
  });

  describe('Admin: orders', () => {
    it('should get order stats', async () => {
      const res = await request
        .get('/api/admin/orders/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should list orders', async () => {
      const res = await request
        .get('/api/admin/orders?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request
        .get('/api/admin/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Admin: product categories', () => {
    it('should list categories', async () => {
      const res = await request
        .get('/api/admin/commerce/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Admin: products CRUD', () => {
    it('should create a product category first', async () => {
      const res = await request
        .post('/api/admin/commerce/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '测试分类', slug: `test-cat-${Date.now()}` });
      expect([200, 201]).toContain(res.status);
    });

    it('should create a product', async () => {
      // First get a category id
      const catRes = await request
        .get('/api/admin/commerce/categories?pageSize=1')
        .set('Authorization', `Bearer ${adminToken}`);
      const categoryId = catRes.body.data?.items?.[0]?.id;

      if (!categoryId) {
        // Skip if no category
        return;
      }

      const res = await request
        .post('/api/admin/commerce/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '测试商品',
          description: 'E2E test',
          categoryId,
          status: 'draft',
        });
      expect([200, 201]).toContain(res.status);
      if (res.body.data?.id) {
        productId = res.body.data.id;
      }
    });

    it('should list products', async () => {
      const res = await request
        .get('/api/admin/commerce/products')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('should get product by id', async () => {
      if (!productId) return;
      const res = await request
        .get(`/api/admin/commerce/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('should update product status', async () => {
      if (!productId) return;
      const res = await request
        .patch(`/api/admin/commerce/products/${productId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });
      expect([200, 201]).toContain(res.status);
    });

    it('should delete product', async () => {
      if (!productId) return;
      const res = await request
        .delete(`/api/admin/commerce/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Admin: promo codes CRUD', () => {
    it('should create a promo code', async () => {
      const res = await request
        .post('/api/admin/commerce/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `TEST${Date.now()}`,
          type: 'fixed',
          value: 10,
          isActive: true,
        });
      expect([200, 201]).toContain(res.status);
      if (res.body.data?.id) {
        promoId = res.body.data.id;
      }
    });

    it('should list promo codes', async () => {
      const res = await request
        .get('/api/admin/commerce/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('should get promo code usage', async () => {
      if (!promoId) return;
      const res = await request
        .get(`/api/admin/commerce/promo-codes/${promoId}/usage`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('should delete promo code', async () => {
      if (!promoId) return;
      const res = await request
        .delete(`/api/admin/commerce/promo-codes/${promoId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.status);
    });
  });
});