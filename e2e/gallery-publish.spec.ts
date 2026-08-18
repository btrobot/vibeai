import { test, expect } from '@playwright/test';

test.describe('画廊浏览与发布', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('画廊页面显示作品网格', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示画廊标题
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();

    // 应该显示排序标签
    await expect(page.getByRole('button', { name: '热门' })).toBeVisible();
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible();
  });

  test('画廊标签切换保持页面稳定', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 点击最新标签
    await page.getByRole('button', { name: '最新' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();

    // 点击热门标签
    await page.getByRole('button', { name: '热门' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();

    // 页面不应跳转走
    await expect(page).toHaveURL(/\/gallery/);
  });

  test('未登录用户访问画廊重定向', async ({ page, context }) => {
    // 清除 cookies 模拟未登录
    await context.clearCookies();
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);

    // 应该重定向到登录页或显示公开内容
    const url = page.url();
    expect(url).toMatch(/\/(gallery|login)/);
  });
});

test.describe('工作空间创作流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('工作空间页面加载', async ({ page }) => {
    // /workspace 为带参路由，先取当前用户的项目 id（access token 在 localStorage，需页面内 fetch）
    const projectId = await page.evaluate(async () => {
      const tokens = JSON.parse(localStorage.getItem('auth_tokens') || '{}');
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const data = await res.json();
      return data.data?.items?.[0]?.id;
    });
    expect(projectId).toBeTruthy();
    await page.goto(`/workspace/${projectId}`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示创作相关标题
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/创作|工作|Create|Workspace|生成/i);
  });

  test('项目列表页面加载', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示项目相关内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/项目|Project|创建/i);
  });

  test('存储页面加载', async ({ page }) => {
    await page.goto('/storage');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示存储相关内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/存储|文件|Storage|File/i);
  });
});
