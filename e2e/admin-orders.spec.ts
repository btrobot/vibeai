import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Orders Tab E2E
 * 覆盖：守卫、加载、统计卡片、状态切换、导出
 */

const ADMIN_EMAIL = 'admin@vibeai.com';
const ADMIN_PASSWORD = 'admin123456';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/\/dashboard/);
}

async function gotoAdminOrdersTab(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '订单管理' }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Orders Tab', () => {
  test('未登录访问 /admin 应跳转到 /login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin 登录后访问 /admin 可看到订单管理 tab', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '订单管理' })).toBeVisible();
  });

  test('订单管理 tab 加载显示 4 张统计卡片', async ({ page }) => {
    // Mock stats endpoint
    await page.route('**/api/admin/orders/stats', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalOrders: 42,
            paidOrders: 30,
            pendingOrders: 8,
            totalRevenue: 1250.50,
          },
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminOrdersTab(page);

    await expect(page.getByText('总订单')).toBeVisible();
    await expect(page.getByText('已支付')).toBeVisible();
    await expect(page.getByText('待支付')).toBeVisible();
    await expect(page.getByText('总收入')).toBeVisible();
  });

  test('订单列表 EmptyState（无订单）', async ({ page }) => {
    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminOrdersTab(page);

    await expect(page.getByText('暂无订单')).toBeVisible();
  });

  test('订单列表显示订单项', async ({ page }) => {
    const mockOrder = {
      id: 'order-abc',
      orderNumber: 'ORD-20260810-000001',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [mockOrder], total: 1, page: 1, pageSize: 10, totalPages: 1 },
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminOrdersTab(page);

    await expect(page.getByText('ORD-20260810-000001')).toBeVisible();
    await expect(page.getByText('待支付').first()).toBeVisible();
  });

  test('点击"导出订单"触发 export API 调用', async ({ page }) => {
    let exportCalled = false;
    await page.route('**/api/admin/orders/export**', (route) => {
      exportCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'orderNumber,status\nORD-001,paid',
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminOrdersTab(page);

    await page.getByRole('button', { name: /导出订单/ }).click();
    // 导出是非阻塞下载（fetch + blob），给一点时间
    await page.waitForTimeout(500);
    expect(exportCalled).toBe(true);
  });
});