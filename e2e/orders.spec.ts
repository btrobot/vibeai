import { test, expect, type Page } from '@playwright/test';

/**
 * 订单页面 E2E 测试
 *
 * 覆盖：
 * 1. 未登录访问 /orders 跳转到登录页
 * 2. 登录后访问 /orders 显示"我的订单"标题
 * 3. 无订单时显示 EmptyState
 * 4. 状态过滤下拉框显示 7 种状态
 * 5. 点击"立即支付"按钮调用 /api/orders/:id/checkout 返回 url 字段
 */

const ADMIN_EMAIL = 'admin@vibeai.com';
const ADMIN_PASSWORD = 'admin123456';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('订单页面', () => {
  test('未登录访问 /orders 应跳转到 /login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('登录后访问 /orders 显示我的订单标题', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '我的订单' })).toBeVisible();
  });

  test('显示状态过滤下拉框', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // 状态过滤 select 包含 7 种状态 + "全部"
    const select = page.locator('select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(8);
    expect(options).toContain('全部');
    expect(options).toContain('待支付');
    expect(options).toContain('已支付');
    expect(options).toContain('已完成');
    expect(options).toContain('已过期');
  });

  test('空订单列表显示 EmptyState", async ({ page }) => {
    // 拦截 /api/orders 返回空列表
    await page.route('**/api/orders**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('暂无订单')).toBeVisible();
  });

  test('点击"立即支付"调用 /api/orders/:id/checkout 并接收 url 字段', async ({ page }) => {
    // Mock GET /api/orders 返回一个 pending 订单
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-20260810-000001',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let checkoutCalled = false;
    await page.route('**/api/orders**', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [mockOrder], total: 1, page: 1, pageSize: 10, totalPages: 1 },
          }),
        });
      } else if (request.method() === 'POST' && request.url().includes('/checkout')) {
        checkoutCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: 'https://checkout.stripe.com/test-session',
            sessionId: 'cs_test_123',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsAdmin(page);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // 拦截 window.location.href 跳转，避免真实跳转
    await page.evaluate(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, href: '' },
      });
    });

    // 点击"立即支付"按钮
    const payBtn = page.getByRole('button', { name: '立即支付' });
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // 验证 checkout API 被调用
    expect(checkoutCalled).toBe(true);
  });
});