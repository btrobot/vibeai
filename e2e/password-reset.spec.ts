import { test, expect } from '@playwright/test';

test.describe('密码重置流程', () => {
  test('忘记密码页面加载', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('load');

    // 应该显示标题和邮箱输入框
    await expect(page.getByRole('heading', { name: '忘记密码' })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送重置链接' })).toBeVisible();
  });

  test('未注册邮箱提交返回成功（防枚举）', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('load');

    // 输入未注册的邮箱
    await page.locator('#email').fill('nonexistent@test.com');
    await page.getByRole('button', { name: '发送重置链接' }).click();

    // 等待响应（无论邮箱是否存在都返回成功）
    await page.waitForTimeout(3000);
    // 应该显示成功提示或重置链接（开发模式）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/已发送|重置链接|成功/i);
  });

  test('无效邮箱格式被拦截', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('load');

    // 输入无效邮箱
    await page.locator('#email').fill('invalid-email');
    await page.getByRole('button', { name: '发送重置链接' }).click();

    // 浏览器原生校验或前端校验应阻止提交
    await page.waitForTimeout(1000);
    // 页面应该仍然在 forgot-password
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('返回登录链接可点击', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('load');

    const loginLink = page.getByRole('link', { name: '返回登录' });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('重置密码页面', () => {
  test('重置密码页面加载', async ({ page }) => {
    await page.goto('/reset-password');
    await page.waitForLoadState('load');

    await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
    await expect(page.locator('#token')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
  });

  test('URL 参数自动填充 token', async ({ page }) => {
    const testToken = 'test-reset-token-123';
    await page.goto(`/reset-password?token=${testToken}`);
    await page.waitForLoadState('load');

    const tokenInput = page.locator('#token');
    await expect(tokenInput).toHaveValue(testToken);
  });

  test('密码可见性切换', async ({ page }) => {
    await page.goto('/reset-password');
    await page.waitForLoadState('load');

    const passwordInput = page.locator('#newPassword');
    await passwordInput.fill('TestPassword123!');

    // 初始类型应为 password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 点击切换按钮
    await page.getByRole('button', { name: /显示密码|隐藏密码/ }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // 再次点击切换回来
    await page.getByRole('button', { name: /显示密码|隐藏密码/ }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
