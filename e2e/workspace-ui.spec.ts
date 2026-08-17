import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'Z/lme83PlgUpglGV6Ha8qifMhVZkGvNhuk0VTbT4nFM=';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

function injectToken(page: import('@playwright/test').Page) {
  const token = jwt.sign(
    { sub: ADMIN_ID, email: 'admin@vibeai.com', role: 'admin', jti: Date.now() },
    JWT_SECRET,
    { expiresIn: '30m' },
  );
  return page.addInitScript((t) => {
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: t, refreshToken: 'x' }));
    // 阻止页面初始加载时因无 token 跳转登录页
    window.dispatchEvent(new Event('storage'));
  }, token);
}

/**
 * 工作区（Workspace）UI 交互 E2E 测试
 * 覆盖新交互：会话流顺序 / 分组折叠 / 长文本展开 / 基于此修改 / 无 JS 错误
 */
test.describe('工作区新交互', () => {
  // 打开"aa"项目工作区
  async function openWorkspace(page: import('@playwright/test').Page) {
    await injectToken(page);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    // 找项目卡片（aa）
    const card = page.locator('.rounded-xl.border.border-border').filter({ hasText: 'aa' }).first();
    await card.click();
    await page.waitForURL(/\/workspace\//, { timeout: 15000 });
    await page.locator('[data-testid="create-list"]').waitFor({ state: 'visible', timeout: 10000 });
  }

  test('1. 分组头显示且卡片为会话流顺序（最新在底部）', async ({ page }) => {
    await openWorkspace(page);

    // 分组头存在
    const groupHeader = page.locator('button:has(svg.lucide-chevron-down)').first();
    await expect(groupHeader).toBeVisible();

    // 卡片数量 ≥ 1
    await expect(page.locator('[data-testid="create-card"]').first()).toBeVisible();

    // 提取卡片时间，验证升序（最早在上，最晚在下）
    const times = await page.locator('[data-testid="create-card"] p.text-xs.text-muted-foreground').allInnerTexts();
    if (times.length > 1) {
      const parsed = times.map((t) => new Date(t.replace(/\//g, '-').replace(/(\d{2}):(\d{2}):(\d{2})/, '$1:$2:$3')).getTime());
      for (let i = 1; i < parsed.length; i++) {
        expect(parsed[i]).toBeGreaterThanOrEqual(parsed[i - 1]);
      }
    }
  });

  test('2. 点击分组头可折叠/展开卡片', async ({ page }) => {
    await openWorkspace(page);

    const cards = page.locator('[data-testid="create-card"]');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();

    const groupBtn = page.locator('button:has(svg.lucide-chevron-down)').first();
    await groupBtn.click();
    await page.waitForTimeout(400);

    // 折叠后卡片不可见
    await expect(cards.first()).toHaveCount(0);

    // 再点击展开
    await groupBtn.click();
    await page.waitForTimeout(400);
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBe(before);
  });

  test('3. 长文本输出可展开全文/收起', async ({ page }) => {
    await openWorkspace(page);

    const expandBtn = page.locator('button:has-text("展开全文")').first();
    if (await expandBtn.count() === 0) {
      test.skip(true, '当前项目无长文本输出，跳过');
      return;
    }

    await expandBtn.click();
    await expect(page.locator('button:has-text("收起")').first()).toBeVisible();

    await page.locator('button:has-text("收起")').first().click();
    await expect(expandBtn).toBeVisible();
  });

  test('4. 提交创作后新卡片追加到底部（会话流）', async ({ page }) => {
    await openWorkspace(page);

    const before = await page.locator('[data-testid="create-card"]').count();
    const textarea = page.locator('textarea[placeholder*="输入提示词"]');
    await textarea.fill(`E2E 会话流测试 ${Date.now()}`);
    await page.getByRole('button', { name: '发送' }).click();

    // 新卡片出现（乐观插入）
    await expect(page.locator('[data-testid="create-card"]')).toHaveCount(before + 1, { timeout: 10000 });

    // 最新卡片（最后一张）包含刚提交的 prompt
    const lastCard = page.locator('[data-testid="create-card"]').last();
    await expect(lastCard).toContainText(`E2E 会话流测试`);
  });

  test('5. 基于此修改按钮存在（已完成创作）', async ({ page }) => {
    await openWorkspace(page);

    await expect(page.locator('button:has-text("基于此修改")').first()).toBeVisible({ timeout: 10000 });
  });

  test('6. 页面无未捕获 JS 错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await openWorkspace(page);

    // 交互一轮（分组折叠/展开）
    const groupBtn = page.locator('button:has(svg.lucide-chevron-down)').first();
    if (await groupBtn.count()) {
      await groupBtn.click();
      await page.waitForTimeout(200);
      await groupBtn.click();
      await page.waitForTimeout(200);
    }

    expect(errors).toEqual([]);
  });
});
