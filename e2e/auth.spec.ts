import { test, expect } from '@playwright/test';

test.describe('认证流程', () => {
  const testEmail = `e2e-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  test('注册新用户', async ({ page }) => {
    await page.goto('/register');

    // 注册页：昵称、邮箱、密码、确认密码
    await page.fill('input#name', 'E2E User');
    await page.fill('input#email', testEmail);
    await page.fill('input#password', testPassword);
    await page.fill('input#confirmPassword', testPassword);
    await page.click('button:has-text("创建账户")');

    // 注册成功后应跳转到登录页
    await page.waitForURL(/\/login/);
    await expect(page.locator('text=欢迎回来')).toBeVisible();
  });

  test('登出并重新登录', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input#email', 'admin@vibeai.com');
    await page.fill('input#password', 'admin123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL(/\/dashboard/);

    // 登出（通过 settings 或导航栏）
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // 重新登录
    await page.goto('/login');
    await page.fill('input#email', 'admin@vibeai.com');
    await page.fill('input#password', 'admin123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator('text=欢迎回来')).toBeVisible();
  });

  test('无效凭证登录失败', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', 'wrong@example.com');
    await page.fill('input#password', 'wrongpass');
    await page.click('button:has-text("登录")');

    // 应显示错误提示且留在登录页
    await expect(page.locator('[class*="destructive"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});