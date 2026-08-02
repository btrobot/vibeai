/**
 * 集成测试脚本
 * 运行方式: pnpm build && cd server && node scripts/test-integration.js
 */
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ValidationPipe } = require('@nestjs/common');
const cookieParser = require('cookie-parser');
const supertest = require('supertest');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTest(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'passed' });
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    results.push({ name, status: 'failed', error: err.message });
    failed++;
    console.log(`  ❌ ${name} - ${err.message}`);
  }
}

async function main() {
  console.log('Starting NestJS application for integration tests...');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.init();

  const request = supertest(app.getHttpServer());
  const testEmail = `test-${Date.now()}@example.com`;

  console.log('\n📋 Auth Integration Tests\n');

  // ─── Register ───
  console.log('  POST /api/auth/register');

  await runTest('should register a new user', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: testEmail, password: 'TestPass123!', name: 'Test User' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.success === true, 'Expected success=true');
    assert(res.body.data.email === testEmail, `Expected email ${testEmail}`);
    assert(res.body.data.credits !== undefined, 'Expected credits');
  });

  await runTest('should reject duplicate email', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: testEmail, password: 'TestPass123!', name: 'Test User' });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
    // NestJS exception format: { message, error, statusCode }
    assert(res.body.message !== undefined, 'Expected error message');
  });

  await runTest('should reject invalid email', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'invalid', password: 'TestPass123!', name: 'Test' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await runTest('should reject weak password', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: '123', name: 'Test' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // ─── Login ───
  console.log('\n  POST /api/auth/login');

  await runTest('should login with valid credentials', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'admin@vibeai.com', password: 'admin123456' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success=true');
    assert(res.body.data.user.email === 'admin@vibeai.com', 'Expected admin email');
    assert(res.body.data.tokens.accessToken !== undefined, 'Expected accessToken');
    assert(res.body.data.tokens.refreshToken !== undefined, 'Expected refreshToken');
  });

  await runTest('should reject wrong password', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'admin@vibeai.com', password: 'wrongpassword' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await runTest('should reject non-existent user', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'TestPass123!' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // ─── Me ───
  console.log('\n  GET /api/auth/me');

  await runTest('should return current user', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'admin@vibeai.com', password: 'admin123456' });
    const accessToken = loginRes.body.data.tokens.accessToken;

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.email === 'admin@vibeai.com', 'Expected admin email');
  });

  // ─── Refresh ───
  console.log('\n  POST /api/auth/refresh');

  await runTest('should refresh token', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'admin@vibeai.com', password: 'admin123456' });
    const refreshToken = loginRes.body.data.tokens.refreshToken;

    const res = await request
      .post('/api/auth/refresh')
      .send({ refreshToken });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success=true');
    assert(res.body.data.tokens.accessToken !== undefined, 'Expected accessToken');
  });

  // ─── Logout ───
  console.log('\n  POST /api/auth/logout');

  await runTest('should logout successfully', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'admin@vibeai.com', password: 'admin123456' });
    const accessToken = loginRes.body.data.tokens.accessToken;
    const refreshToken = loginRes.body.data.tokens.refreshToken;

    const res = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success=true');
  });

  // ─── Summary ───
  console.log(`\n\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});