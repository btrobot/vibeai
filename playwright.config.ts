import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * E2E 运行契约：
 * 1. 后端必须以 INTEGRATION_TEST=true 启动（CustomThrottlerGuard 跳过限流，
 *    否则 auth 5/min 会被并发 UI 登录打爆 → waitForURL 超时）。
 *    本地：tmux 内 `cd server && INTEGRATION_TEST=true pnpm dev`（端口 3001）。
 * 2. 前端必须是 Vite dev server（SPA fallback + /api 代理），
 *    本地默认 http://localhost:5001（5000 静态服务无 SPA fallback）。
 * 3. 运行：E2E_BASE_URL=http://localhost:5001 npx playwright test
 * 4. 依赖 fresh 库夹具：admin@vibeai.com/admin123456（role=admin）+ 项目 "aa"。
 *    重跑前如数据漂移，用 pnpm db:migrate && pnpm db:seed 重建后恢复夹具。
 *
 * CI 模式（E2E_CI_SERVERS=1）：
 * - 由 webServer 自起后端（node dist/main.js，启动即迁移+种子）与前端（vite dev），
 *   配合 GitHub Actions postgres service container（DATABASE_URL 由 job env 注入）。
 */
const ciWebServers = process.env.E2E_CI_SERVERS === '1';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report' }]],
  timeout: 30000,
  // CI 自包含：webServer 由 Playwright 托管启动/探活/清理（本地默认关闭，沿用外部 tmux 服务）
  webServer: ciWebServers
    ? [
        {
          command: 'node dist/main.js',
          cwd: path.resolve(process.cwd(), 'server'),
          port: 3001,
          timeout: 120000,
          reuseExistingServer: false,
          env: {
            PORT: '3001',
            INTEGRATION_TEST: 'true',
            STORAGE_PROVIDER: 'local',
          },
        },
        {
          command: 'pnpm dev:frontend',
          port: 5000,
          timeout: 60000,
          reuseExistingServer: false,
        },
      ]
    : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
});
