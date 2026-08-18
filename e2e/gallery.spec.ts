import { test, expect } from '@playwright/test';

test.describe('画廊浏览', () => {
  test.beforeEach(async ({ page }) => {
    // 画廊需要登录，先登录
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('公开画廊页面加载', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    // 等待画廊数据加载完成
    await page.waitForTimeout(2000);

    // 应该显示排序标签（热门/最新，关注标签已下线）
    await expect(page.getByRole('button', { name: '热门' })).toBeVisible();
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible();
  });

  test('切换画廊标签', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    // 等待画廊数据加载完成
    await page.waitForTimeout(2000);

    // 点击最新标签
    await page.getByRole('button', { name: '最新' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible();

    // 切回热门标签
    await page.getByRole('button', { name: '热门' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '热门' })).toBeVisible();
  });

  test('已登录用户可访问画廊', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('load');
    // 等待画廊数据加载完成
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: '社区画廊' })).toBeVisible();
  });
});