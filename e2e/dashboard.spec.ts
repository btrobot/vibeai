import { test, expect } from '@playwright/test';

test.describe('仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vibeai.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('仪表盘页面加载并显示统计信息', async ({ page }) => {
    await expect(page.locator('text=项目')).toBeVisible();
    await expect(page.locator('text=任务')).toBeVisible();
  });

  test('侧边导航可用', async ({ page }) => {
    const navLinks = ['项目', '存储', '计费', '画廊', '设置'];
    for (const link of navLinks) {
      await expect(page.locator(`nav >> text=${link}`)).toBeVisible();
    }
  });

  test('跳转到画廊页面', async ({ page }) => {
    await page.click('nav >> text=画廊');
    await page.waitForURL(/\/gallery/);
    await expect(page.locator('text=作品')).toBeVisible();
  });
});