import { test, expect, type Page } from '@playwright/test';

/**
 * 注册 → 登录 → 仪表盘 完整流程 E2E 测试
 *
 * 测试覆盖：
 * 1. 新用户注册 → 跳转登录页
 * 2. 用新账户登录 → 跳转仪表盘
 * 3. 仪表盘内容加载
 * 4. 受保护页面导航
 * 5. 登出 → 重登录
 * 6. 表单校验（空字段、密码不一致、重复邮箱）
 * 7. 未登录访问受保护页面 → 重定向到登录
 */

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
const TEST_PASSWORD = 'E2ePass123!';

/** 辅助函数：执行注册流程 */
async function doRegister(page: Page, name: string, email: string, password: string) {
  await page.goto('/register');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: '创建账户' }).click();
}

/** 辅助函数：执行登录流程 */
async function doLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
}

test.describe('注册 → 登录 完整流程', () => {
  const email = uniqueEmail();

  test('1. 注册新用户 → 跳转登录页', async ({ page }) => {
    await doRegister(page, 'E2E Tester', email, TEST_PASSWORD);

    // 注册成功后跳转到登录页
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByText('欢迎回来')).toBeVisible();
  });

  test('2. 用新注册账户登录 → 跳转仪表盘', async ({ page }) => {
    await doLogin(page, email, TEST_PASSWORD);

    // 登录后跳转到 / → /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    // 仪表盘欢迎信息
    await expect(page.getByRole('heading', { name: /欢迎回来/ })).toBeVisible({ timeout: 10000 });
  });

  test('3. 仪表盘内容正确加载', async ({ page }) => {
    // 先登录
    await doLogin(page, email, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // 统计卡片
    await expect(page.getByText('项目总数')).toBeVisible();
    await expect(page.getByText('任务总数')).toBeVisible();
  });

  test('4. 受保护页面导航正常', async ({ page }) => {
    await doLogin(page, email, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // 导航到项目页
    await page.locator('nav').getByText('我的项目').click();
    await page.waitForURL(/\/projects/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /项目/ })).toBeVisible();

    // 导航到设置页
    await page.locator('nav').getByText('设置').click();
    await page.waitForURL(/\/settings/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /设置/ })).toBeVisible();

    // 导航到画廊
    await page.locator('nav').getByText('社区画廊').click();
    await page.waitForURL(/\/gallery/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /画廊/ })).toBeVisible();
  });

  test('5. 登出 → 重登录', async ({ page }) => {
    // 登录
    await doLogin(page, email, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // 登出
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByText('欢迎回来')).toBeVisible();

    // 重登录
    await doLogin(page, email, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /欢迎回来/ })).toBeVisible();
  });
});

test.describe('注册表单校验', () => {
  test('空字段提交 → 显示错误', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: '创建账户' }).click();

    // 应显示错误提示且留在注册页
    await expect(page.locator('[class*="destructive"]')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('密码不一致 → 显示错误', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@test.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirmPassword').fill('DifferentPass123!');
    await page.getByRole('button', { name: '创建账户' }).click();

    // 密码不一致错误
    await expect(page.locator('[class*="destructive"]')).toContainText('不一致');
    await expect(page).toHaveURL(/\/register/);
  });

  test('密码太短 → 显示错误', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('short@test.com');
    await page.locator('#password').fill('Ab1!');
    await page.locator('#confirmPassword').fill('Ab1!');
    await page.getByRole('button', { name: '创建账户' }).click();

    // 密码长度错误
    await expect(page.locator('[class*="destructive"]')).toContainText('8');
    await expect(page).toHaveURL(/\/register/);
  });

  test('重复邮箱注册 → 显示错误', async ({ page }) => {
    // 使用已有的种子用户邮箱
    await page.goto('/register');
    await page.locator('#name').fill('Duplicate');
    await page.locator('#email').fill('test@vibeai.com');
    await page.locator('#password').fill('TestPass123!');
    await page.locator('#confirmPassword').fill('TestPass123!');
    await page.getByRole('button', { name: '创建账户' }).click();

    // 邮箱已存在错误
    await expect(page.locator('[class*="destructive"]')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('登录表单校验', () => {
  test('错误凭证 → 显示错误', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('nonexistent@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page.locator('[class*="destructive"]')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('空字段 → 显示错误', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page.locator('[class*="destructive"]')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('未认证访问保护', () => {
  test('未登录访问仪表盘 → 重定向到登录', async ({ page }) => {
    // 清除 localStorage 确保未登录
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');

    // 应被重定向到登录页
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByText('欢迎回来')).toBeVisible();
  });

  test('未登录访问项目页 → 重定向到登录', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/projects');

    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('未登录访问设置页 → 重定向到登录', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/settings');

    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
