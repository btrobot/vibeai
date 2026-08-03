import { test, expect } from '@playwright/test';

test.describe('认证流程', () => {
  const testEmail = `e2e-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  test('注册新用户', async ({ page }) => {
    await page.goto('/register');

    // 注册页面使用 id 选择器
    await page.locator('#name').fill('E2E User');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await page.locator('#confirmPassword').fill(testPassword);
    await page.getByRole('button', { name: '创建账户' }).click();

    // 注册成功后跳转到登录页
    await page.waitForURL(/\/login/);
    await expect(page.getByText('欢迎回来')).toBeVisible();
  });

  test('登出并重新登录', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    // 登录后跳转到 / → /dashboard
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /欢迎回来/ })).toBeVisible();

    // 登出
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByText('欢迎回来')).toBeVisible();

    // 重新登录
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /欢迎回来/ })).toBeVisible();
  });

  test('无效凭证登录失败', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpass');
    await page.getByRole('button', { name: '登录' }).click();

    // 应显示错误提示且留在登录页
    await expect(page.locator('[class*="destructive"]')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});