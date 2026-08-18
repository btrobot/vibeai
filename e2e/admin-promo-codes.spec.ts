import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Promo Codes Tab E2E
 * 覆盖：tab 加载、新建、使用统计查看、删除
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

async function gotoAdminPromoTab(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '促销码' }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Promo Codes Tab', () => {
  test('admin 登录后访问促销码 tab', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await expect(page.getByRole('button', { name: /新建促销码/ })).toBeVisible();
  });

  test('空列表显示 EmptyState', async ({ page }) => {
    await page.route('**/api/admin/commerce/promo-codes**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [], total: 0, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await expect(page.getByText('暂无促销码')).toBeVisible();
  });

  test('点击"新建促销码"打开对话框', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await page.getByRole('button', { name: /新建促销码/ }).click();
    await expect(page.getByRole('heading', { name: '新建促销码' })).toBeVisible();
    await expect(page.locator('#pc-code')).toBeVisible();
  });

  test('新建促销码：填表单 + 提交触发 POST', async ({ page }) => {
    let createCalled = false;
    let createBody: any = null;
    await page.route('**/api/admin/commerce/promo-codes', async (route, request) => {
      if (request.method() === 'POST') {
        createCalled = true;
        createBody = JSON.parse(request.postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'pc-new', ...createBody },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [], total: 0, page: 1, pageSize: 10, totalPages: 1,
          }),
        });
      }
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await page.getByRole('button', { name: /新建促销码/ }).click();
    await page.locator('#pc-code').fill('SAVE20');
    await page.locator('input[type="number"]').first().fill('20');
    await page.getByRole('button', { name: '创建' }).click();

    expect(createCalled).toBe(true);
    expect(createBody.code).toBe('SAVE20');
    expect(createBody.type).toBe('fixed');
    expect(createBody.value).toBe(20);
  });

  test('点击"使用统计"按钮调用 usage API', async ({ page }) => {
    const mockPromo = {
      id: 'pc-1',
      code: 'SAVE10',
      type: 'fixed',
      value: 10,
      maxUses: 100,
      usedCount: 5,
      isActive: true,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/commerce/promo-codes?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockPromo], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    let usageCalled = false;
    await page.route('**/api/admin/commerce/promo-codes/**/usage', (route) => {
      usageCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            promoCodeId: 'pc-1',
            code: 'SAVE10',
            totalUses: 5,
            maxUses: 100,
            usageRate: 0.05,
          },
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await page.locator('button[title="使用统计"]').first().click();
    await page.waitForTimeout(500);
    expect(usageCalled).toBe(true);
  });

  test('删除促销码：点删除按钮触发 DELETE', async ({ page }) => {
    const mockPromo = {
      id: 'pc-del',
      code: 'DELETE_ME',
      type: 'fixed',
      value: 5,
      maxUses: 10,
      usedCount: 0,
      isActive: true,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let deleteCalled = false;
    await page.route('**/api/admin/commerce/promo-codes/**', async (route, request) => {
      if (request.method() === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: '已删除' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/admin/commerce/promo-codes?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockPromo], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    page.on('dialog', (d) => d.accept());

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminPromoTab(page);

    await page.locator('button[title="删除"]').first().click();
    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });
});