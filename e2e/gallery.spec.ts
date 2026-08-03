import { test, expect } from '@playwright/test';

test.describe('画廊浏览', () => {
  test('公开画廊页面加载', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // 应该显示标签页
    await expect(page.locator('text=热门')).toBeVisible();
    await expect(page.locator('text=最新')).toBeVisible();
    await expect(page.locator('text=关注')).toBeVisible();
  });

  test('切换画廊标签', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // 点击最新标签
    await page.click('text=最新');
    await page.waitForTimeout(500);
    await expect(page.locator('text=最新')).toBeVisible();

    // 点击关注标签
    await page.click('text=关注');
    await page.waitForTimeout(500);
    await expect(page.locator('text=关注')).toBeVisible();
  });

  test('已登录用户可访问画廊', async ({ page }) => {
    // 登录后访问画廊
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vibeai.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=作品')).toBeVisible();
  });
});