/**
 * Gateway 模块集成测试
 * 运行方式: pnpm build && cd server && node scripts/test-integration.js
 *
 * 覆盖端到端流程: 注册 → 登录 → 创建项目 → 提交生成(image/text/video) → 查询任务状态 → 验证积分扣减
 *
 * 关键回归点:
 * - [BUGFIX] credit_usage.task_id 是 UUID 类型，reserveCredits 在任务创建前调用时传 null（非 'pending'）
 * - Mock 适配器在无 API Token 时返回伪造结果，验证完整流程
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

process.env.DATABASE_URL = 'postgresql://vibeai:vibeai123@127.0.0.1:5432/vibeai?sslmode=disable';

describe('Gateway Integration', () => {
  let app: any;
  let request: any;
  let gwToken: string;
  let projectId: string;

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

  describe('Setup: register + login + create project', () => {
    const testEmail = `gw-${Date.now()}@example.com`;

    it('should register a gateway test user', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ email: testEmail, password: 'TestPass123!', name: 'GW Test' });
      expect(res.status).toBe(201);
      expect(res.body.data.credits).toBeGreaterThanOrEqual(100);
    });

    it('should login and get token', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'TestPass123!' });
      expect(res.status).toBe(200);
      gwToken = res.body.data.tokens.accessToken;
      expect(gwToken).toBeDefined();
    });

    it('should create a project', async () => {
      const res = await request
        .post('/api/projects')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({ name: 'Gateway Integration Project', description: 'test' });
      expect(res.status).toBe(201);
      projectId = res.body.data.id;
      expect(projectId).toBeDefined();
    });
  });

  describe('GET /api/gateway/capabilities', () => {
    it('should list capabilities', async () => {
      const res = await request
        .get('/api/gateway/capabilities')
        .set('Authorization', `Bearer ${gwToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/gateway/models', () => {
    it('should list models', async () => {
      const res = await request
        .get('/api/gateway/models')
        .set('Authorization', `Bearer ${gwToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/gateway/generate (image)', () => {
    let taskId: string;

    it('should submit image generation without 500 error', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({
          projectId,
          capabilitySlug: 'image-generation',
          modelSlug: 'doubao-seedream-5-0',
          input: { prompt: 'a cute cat in a garden' },
        });
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskId).toBeDefined();
      expect(res.body.data.createId).toBeDefined();
      taskId = res.body.data.taskId;
    });

    it('should query task status', async () => {
      const res = await request
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${gwToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('should have task completed after mock execution', async () => {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const res = await request
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${gwToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.output).not.toBeNull();
    });
  });

  describe('POST /api/gateway/generate (text)', () => {
    it('should submit text generation', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({
          projectId,
          capabilitySlug: 'text-generation',
          modelSlug: 'doubao-pro-32k',
          input: { prompt: 'Write a short poem about the ocean' },
        });
      expect(res.status).toBe(202);
      expect(res.body.data.taskId).toBeDefined();
    });
  });

  describe('POST /api/gateway/generate (video)', () => {
    it('should submit video generation', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({
          projectId,
          capabilitySlug: 'video-generation',
          modelSlug: 'doubao-seedance-1-0',
          input: { prompt: 'A sunset over mountains' },
        });
      expect(res.status).toBe(202);
      expect(res.body.data.taskId).toBeDefined();
    });
  });

  describe('Credit deduction', () => {
    it('should have deducted credits after 3 generations', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${gwToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.credits).toBeLessThan(100);
    });
  });

  describe('Error cases', () => {
    it('should reject invalid capability', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({
          projectId,
          capabilitySlug: 'nonexistent',
          input: { prompt: 'test' },
        });
      expect(res.status).toBe(404);
    });

    it('should reject without auth', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .send({
          projectId,
          capabilitySlug: 'image-generation',
          input: { prompt: 'test' },
        });
      expect(res.status).toBe(401);
    });

    it('should reject empty projectId', async () => {
      const res = await request
        .post('/api/gateway/generate')
        .set('Authorization', `Bearer ${gwToken}`)
        .send({
          projectId: '',
          capabilitySlug: 'image-generation',
          input: { prompt: 'test' },
        });
      expect(res.status).toBe(400);
    });
  });
});
