import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Products Tab E2E
 * 覆盖：tab 加载、分类筛选、新建、编辑、删除
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

async function gotoAdminProductsTab(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '商品管理' }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Products Tab', () => {
  test('admin 登录后访问商品管理 tab', async ({ page }) => {
    await page.route('**/api/admin/commerce/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminProductsTab(page);

    await expect(page.getByRole('button', { name: /新建商品/ })).toBeVisible();
    await expect(page.getByText('分类筛选')).toBeVisible();
  });

  test('空商品列表显示 EmptyState', async ({ page }) => {
    await page.route('**/api/admin/commerce/products**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [], total: 0, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminProductsTab(page);

    await expect(page.getByText('暂无商品')).toBeVisible();
  });

  test('点击"新建商品"打开对话框', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminProductsTab(page);

    await page.getByRole('button', { name: /新建商品/ }).click();
    await expect(page.getByRole('heading', { name: '新建商品' })).toBeVisible();
    await expect(page.locator('#prod-name')).toBeVisible();
    await expect(page.locator('#prod-cat')).toBeVisible();
    await expect(page.locator('#prod-status')).toBeVisible();
  });

  test('新建商品对话框：填表单 + 提交触发 POST', async ({ page }) => {
    const mockCategory = { id: 'cat-1', name: '服装' };

    await page.route('**/api/admin/commerce/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockCategory], total: 1,
        }),
      });
    });

    let createCalled = false;
    let createBody: any = null;
    await page.route('**/api/admin/commerce/products', async (route, request) => {
      if (request.method() === 'POST') {
        createCalled = true;
        createBody = JSON.parse(request.postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'prod-new', ...createBody },
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
    await gotoAdminProductsTab(page);

    await page.getByRole('button', { name: /新建商品/ }).click();
    await page.locator('#prod-name').fill('测试商品');
    await page.locator('#prod-cat').selectOption('cat-1');
    await page.locator('#prod-status').selectOption('active');
    await page.getByRole('button', { name: '创建' }).click();

    expect(createCalled).toBe(true);
    expect(createBody.name).toBe('测试商品');
    expect(createBody.categoryId).toBe('cat-1');
    expect(createBody.status).toBe('active');
  });

  test('编辑商品：点编辑按钮打开对话框并预填', async ({ page }) => {
    const mockProduct = {
      id: 'prod-1',
      name: '现有商品',
      description: '描述',
      categoryId: 'cat-1',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/commerce/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [{ id: 'cat-1', name: '服装' }], total: 1 },
        }),
      });
    });

    await page.route('**/api/admin/commerce/products**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockProduct], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminProductsTab(page);

    await expect(page.getByText('现有商品')).toBeVisible();

    // 点编辑按钮（title="编辑"）
    await page.locator('button[title="编辑"]').first().click();
    await expect(page.getByRole('heading', { name: '编辑商品' })).toBeVisible();
    // 名称应该被预填
    await expect(page.locator('#prod-name')).toHaveValue('现有商品');
  });

  test('删除商品：点删除按钮触发 DELETE', async ({ page }) => {
    const mockProduct = {
      id: 'prod-del',
      name: '待删除商品',
      description: '',
      categoryId: 'cat-1',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route('**/api/admin/commerce/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [], total: 0,
        }),
      });
    });

    let deleteCalled = false;
    await page.route('**/api/admin/commerce/products/**', async (route, request) => {
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

    await page.route('**/api/admin/commerce/products?**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockProduct], total: 1, page: 1, pageSize: 10, totalPages: 1,
        }),
      });
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await gotoAdminProductsTab(page);

    // 自动确认 dialog
    page.on('dialog', (d) => d.accept());

    await page.locator('button[title="删除"]').first().click();
    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });
});