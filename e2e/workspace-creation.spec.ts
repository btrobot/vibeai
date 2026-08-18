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

  test('1. 图片 Tab：能力选择器出现，选"图片编辑"后模型过滤 + 通用多参考图堆叠', async ({ page }) => {
    await openWorkspace(page);

    // 进入图片 Tab
    await page.getByTitle('图片').click();
    const capSelect = page.getByRole('combobox', { name: '图片能力' });
    await expect(capSelect).toBeVisible();

    // 默认自动识别：模型下拉加载（modality=image → seedream-5-0 默认）
    const modelSelect = page.getByRole('combobox', { name: '模型' });
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect).toHaveValue('doubao-seedream-5-0', { timeout: 10000 });

    // 手动选"图片编辑"：模型按 capability 过滤（seedream-5-0 优先）+ 通用多参考图堆叠（无角色槽位）
    await capSelect.selectOption('image-editing');
    await expect(modelSelect).toHaveValue('doubao-seedream-5-0');
    await expect(page.getByLabel('上传参考图')).toBeVisible({ timeout: 5000 });

    // 切回自动识别：仍为通用参考图堆叠（自动识别不分配角色槽位）
    await capSelect.selectOption('');
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

    // 图片能力切换：自动 → 场景合成 → 自动
    await page.getByTitle('图片').click();
    const imgCap = page.getByRole('combobox', { name: '图片能力' });
    await expect(imgCap).toBeVisible();
    await imgCap.selectOption('image-editing');
    await imgCap.selectOption('');
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
