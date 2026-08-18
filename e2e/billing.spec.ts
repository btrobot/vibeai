import { test, expect } from '@playwright/test';

test.describe('计费页面', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('#email').fill('admin@vibeai.com');
    await page.locator('#password').fill('admin123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('计费页面加载并显示套餐', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示页面标题
    await expect(page.getByRole('heading', { name: '计费管理' })).toBeVisible();

    // 应该显示选择套餐标题
    await expect(page.getByText('选择套餐')).toBeVisible();
  });

  test('显示套餐列表', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示套餐名称（免费版/入门版/专业版等）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/免费|Free|Starter|Pro|套餐/i);
  });

  test('显示用量统计信息', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 应该显示用量相关文本
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/信用|额度|用量|Credits|credit/i);
  });

  test('订阅信息区域可见', async ({ page }) => {
    // mock 订阅接口：无订阅时不渲染订阅信息区，测试需预置订阅数据
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'sub-mock-1',
            plan: { slug: 'pro', name: '专业版' },
            billingCycle: 'monthly',
            autoRenew: true,
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        }),
      }),
    );
    await page.goto('/billing');
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // 应该显示订阅信息区域
    await expect(page.getByText('订阅信息')).toBeVisible();
  });
});
