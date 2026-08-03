import { test, expect } from '@playwright/test';

test.describe('仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input#email', 'admin@vibeai.com');
    await page.fill('input#password', 'admin123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL(/\/dashboard/);
  });

  test('仪表盘页面加载并显示统计信息', async ({ page }) => {
    await expect(page.locator('text=欢迎回来')).toBeVisible();
    await expect(page.locator('text=项目总数')).toBeVisible();
    await expect(page.locator('text=任务总数')).toBeVisible();
  });

  test('侧边导航可用', async ({ page }) => {
    const navLinks = ['仪表盘', '我的项目', '社区画廊', '设置', '管理后台'];
    for (const link of navLinks) {
      await expect(page.locator(`aside >> text="${link}"`)).toBeVisible();
    }
  });

  test('跳转到画廊页面', async ({ page }) => {
    await page.click('aside >> text="社区画廊"');
    await page.waitForURL(/\/gallery/);
    await expect(page.locator('text=社区画廊')).toBeVisible();
  });
});