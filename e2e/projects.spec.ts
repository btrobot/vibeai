import { test, expect } from '@playwright/test';

test.describe('项目流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', 'admin@vibeai.com');
    await page.fill('input#password', 'admin123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL(/\/dashboard/);
  });

  test('创建新项目', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // 点击新建项目按钮
    await page.click('button:has-text("新建项目")');
    await page.waitForTimeout(500);

    // 填写项目名称
    const projectName = `E2E 测试项目 ${Date.now()}`;
    const input = page.locator('input[placeholder="输入项目名称"]');
    if (await input.isVisible()) {
      await input.fill(projectName);
      // 在模态框内点击"创建"按钮（使用 disabled 状态区分，排除"创建第一个项目"）
      await page.locator('.fixed.inset-0 button:not([disabled]):has-text("创建")').click();
      await page.waitForTimeout(1000);
    }
  });

  test('项目列表加载', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
  });
});