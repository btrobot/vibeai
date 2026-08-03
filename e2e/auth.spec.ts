import { test, expect } from '@playwright/test';

test.describe('认证流程', () => {
  const testEmail = `e2e-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  test('注册新用户', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[placeholder*="密码"]', testPassword);
    await page.fill('input[placeholder*="姓名"]', 'E2E User');
    await page.click('button[type="submit"]');

    // 注册成功后应跳转到首页
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator('text=VibeAI')).toBeVisible();
  });

  test('登出并重新登录', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vibeai.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // 登出（通过 settings 或导航栏）
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // 重新登录
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vibeai.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator('text=VibeAI')).toBeVisible();
  });

  test('无效凭证登录失败', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[placeholder*="密码"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // 应显示错误提示且留在登录页
    await expect(page.locator('text=邮箱或密码错误').or(page.locator('text=登录失败'))).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});