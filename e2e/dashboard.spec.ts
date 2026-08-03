import { test, expect } from '@playwright/test';

test.describe('仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('仪表盘页面加载并显示统计信息', async ({ page }) => {
    // 仪表盘显示统计卡片
    await expect(page.getByText('项目总数')).toBeVisible();
    await expect(page.getByText('任务总数')).toBeVisible();
  });

  test('侧边导航可用', async ({ page }) => {
    const navLinks = ['我的项目', '社区画廊', '设置', '管理后台'];
    for (const link of navLinks) {
      await expect(page.locator('nav').getByText(link)).toBeVisible();
    }
  });

  test('跳转到画廊页面', async ({ page }) => {
    await page.locator('nav').getByText('社区画廊').click();
    await page.waitForURL(/\/gallery/);
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();
  });
});