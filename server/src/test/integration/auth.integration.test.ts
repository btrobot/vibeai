/**
 * 认证模块集成测试
 * 运行方式: pnpm build && node scripts/test-integration.js
 * 
 * 注意: 由于 tsx ESM loader 与 NestJS 装饰器不兼容，集成测试无法通过 vitest 运行。
 * 请使用 `pnpm build && node scripts/test-integration.js` 运行。
 * 
 * 根因: NestJS 的 @nestjs/testing 和 NestFactory.create 在 tsx 环境下
 * 无法正确解析装饰器元数据，导致依赖注入失败（authService 为 undefined）。
 * 编译为 JavaScript 后使用 node 运行则正常。
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

process.env.DATABASE_URL = 'postgresql://vibeai:vibeai123@127.0.0.1:5432/vibeai?sslmode=disable';

describe('Auth Integration', () => {
  let app;
  let request;

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

  describe('POST /api/auth/register', () => {
    const testEmail = `test-${Date.now()}@example.com`;

    it('should register a new user', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: testEmail, password: 'TestPass123!', name: 'Test User' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testEmail);
    });

    it('should reject duplicate email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: testEmail, password: 'TestPass123!', name: 'Test User' });
      expect(res.status).toBe(409);
      expect(res.body.message).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: 'invalid', password: 'TestPass123!', name: 'Test' });
      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: 'weak@example.com', password: '123', name: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('admin@vibeai.com');
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should login multiple times within same second', async () => {
      const r1 = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      expect(r1.status).toBe(200);
      expect(r1.body.data.tokens.accessToken).toBeDefined();

      const r2 = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      expect(r2.status).toBe(200);
      expect(r2.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'TestPass123!' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      const accessToken = loginRes.body.data.tokens.accessToken;

      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('admin@vibeai.com');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      const refreshToken = loginRes.body.data.tokens.refreshToken;

      const res = await request
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@vibeai.com', password: 'admin123456' });
      const accessToken = loginRes.body.data.tokens.accessToken;
      const refreshToken = loginRes.body.data.tokens.refreshToken;

      const res = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});