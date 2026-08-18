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
    window.dispatchEvent(new Event('storage'));
  }, token);
}

/**
 * 工作区（Workspace）创建链路 E2E
 * 覆盖新交互：图片能力显式选择（模型过滤 + 角色槽位）/ 视频能力切换（首帧槽 ↔ 参考视频槽）
 * 依赖 CI 环境种子模型数据（SEED_MODELS），不依赖真实文件上传（上传有组件/单元测试覆盖）。
 */
test.describe('工作区图片/视频创建链路', () => {
  async function openWorkspace(page: import('@playwright/test').Page) {
    await injectToken(page);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const card = page.locator('.rounded-xl.border.border-border').filter({ hasText: 'aa' }).first();
    await card.click();
    await page.waitForURL(/\/workspace\//, { timeout: 15000 });
    await page.locator('[data-testid="create-list"]').waitFor({ state: 'visible', timeout: 10000 });
  }

  test('1. 图片 Tab：默认打开、无能力选择器（纯自动识别）、默认模型 gpt-image-2、通用参考图堆叠', async ({ page }) => {
    await openWorkspace(page);

    // 默认 Tab = 图片（mode 默认图片）
    await expect(page.getByTitle('图片')).toBeVisible();
    // 图片能力选择器已删除（有参考图 → 图片编辑；无参考图 → 文生图，无正则判定）
    await expect(page.getByRole('combobox', { name: '图片能力' })).toHaveCount(0);
    // 模型默认 gpt-image-2（对齐 boli）
    const modelSelect = page.getByRole('combobox', { name: '模型' });
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect).toHaveValue('gpt-image-2', { timeout: 10000 });
    // 通用参考图堆叠（无角色槽位）
    await expect(page.getByLabel('上传参考图')).toBeVisible({ timeout: 5000 });
  });

  test('2. 视频 Tab：能力切换 → 风格克隆参考视频槽 / 自动首帧图槽', async ({ page }) => {
    await openWorkspace(page);

    await page.getByTitle('视频生成').click();
    const capSelect = page.getByRole('combobox', { name: '视频能力' });
    await expect(capSelect).toBeVisible();

    // 默认（自动 = 视频生成）：首帧图槽
    await expect(page.getByLabel('首帧图（点击上传）')).toBeVisible({ timeout: 10000 });

    // 风格克隆：参考视频槽出现，首帧槽收起
    await capSelect.selectOption('style-cloning');
    await expect(page.getByLabel('参考视频（点击上传）')).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('首帧图（点击上传）')).toHaveCount(0);

    // 切回自动：首帧槽恢复
    await capSelect.selectOption('');
    await expect(page.getByLabel('首帧图（点击上传）')).toBeVisible({ timeout: 10000 });
  });

  test('3. 能力切换交互无未捕获 JS 错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await openWorkspace(page);

    // 图片 Tab：无能力选择器（纯自动识别），无未捕获错误
    await page.getByTitle('图片').click();
    await expect(page.getByRole('combobox', { name: '图片能力' })).toHaveCount(0);
    await page.waitForTimeout(200);

    // 视频能力切换：自动 → 风格克隆 → 自动
    await page.getByTitle('视频生成').click();
    const vidCap = page.getByRole('combobox', { name: '视频能力' });
    await expect(vidCap).toBeVisible();
    await vidCap.selectOption('style-cloning');
    await vidCap.selectOption('');
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });
});
