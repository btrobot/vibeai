import { test, expect } from '@playwright/test';

test.describe('项目流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('创建新项目', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // 点击创建项目按钮
    await page.getByText('新建项目').click();
    await page.waitForTimeout(500);

    // 填写项目名称
    const projectName = `E2E 测试项目 ${Date.now()}`;
    const input = page.locator('input[placeholder="输入项目名称"]');
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill(projectName);
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.waitForTimeout(1000);
  });

  test('项目列表加载', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
  });
});