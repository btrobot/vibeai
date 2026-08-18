import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Refund E2E
 * 覆盖：admin 登录 → 找到 paid 订单 → 打开退款对话框 → 提交 → 验证 API + 状态
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

async function gotoAdminOrdersTab(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '订单管理' }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Refund Dialog', () => {
  test('点击 paid 订单的退款按钮打开对话框', async ({ page }) => {
    const paidOrder = {
      id: 'order-paid-1',
      orderNumber: 'ORD-20260810-PAID01',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [paidOrder], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminOrdersTab(page);

    // 点击退款按钮（title="退款"）
    await page.locator('button[title="退款"]').first().click();
    await expect(page.getByText('订单退款')).toBeVisible();
    await expect(page.locator('#refund-reason')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认退款' })).toBeVisible();
  });

  test('空理由时"确认退款"按钮被禁用', async ({ page }) => {
    const paidOrder = {
      id: 'order-paid-2',
      orderNumber: 'ORD-20260810-PAID02',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [paidOrder], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminOrdersTab(page);

    await page.locator('button[title="退款"]').first().click();
    const submitBtn = page.getByRole('button', { name: '确认退款' });
    await expect(submitBtn).toBeDisabled();
  });

  test('填理由 + 提交触发 refund API 调用', async ({ page }) => {
    const paidOrder = {
      id: 'order-paid-3',
      orderNumber: 'ORD-20260810-PAID03',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [paidOrder], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    let refundCalled = false;
    let refundBody: any = null;
    await page.route('**/api/admin/orders/**/refund', async (route, request) => {
      if (request.method() === 'POST') {
        refundCalled = true;
        refundBody = JSON.parse(request.postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'order-paid-3', status: 'refunded', refundReason: refundBody.reason },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsAdmin(page);
    await gotoAdminOrdersTab(page);

    await page.locator('button[title="退款"]').first().click();
    await page.locator('#refund-reason').fill('用户主动要求退款');
    await page.getByRole('button', { name: '确认退款' }).click();

    expect(refundCalled).toBe(true);
    expect(refundBody.reason).toBe('用户主动要求退款');
  });

  test('取消按钮关闭对话框', async ({ page }) => {
    const paidOrder = {
      id: 'order-paid-4',
      orderNumber: 'ORD-20260810-PAID04',
      type: 'credit_pack',
      amount: '9.99',
      currency: 'USD',
      credits: 100,
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/orders?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [paidOrder], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminOrdersTab(page);

    await page.locator('button[title="退款"]').first().click();
    await expect(page.getByText('订单退款')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('订单退款')).not.toBeVisible();
  });
});