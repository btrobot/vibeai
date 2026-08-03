import { test, expect } from '@playwright/test';

test.describe('画廊浏览', () => {
  // 画廊页面需要登录（AuthGuard），先统一登录
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', 'admin@vibeai.com');
    await page.fill('input#password', 'admin123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL(/\/dashboard/);
  });

  test('公开画廊页面加载', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // 应该显示标签页
    await expect(page.getByRole('button', { name: '热门' })).toBeVisible();
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible();
    await expect(page.getByRole('button', { name: '关注' })).toBeVisible();
  });

  test('切换画廊标签', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // 点击最新标签
    await page.getByRole('button', { name: '最新' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible();

    // 点击关注标签
    await page.getByRole('button', { name: '关注' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '关注' })).toBeVisible();
  });

  test('已登录用户可访问画廊', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();
  });
});