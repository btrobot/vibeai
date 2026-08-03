# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 认证流程 >> 注册新用户
- Location: e2e/auth.spec.ts:7:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[placeholder*="姓名"]')

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e11]: 创建账户
    - generic [ref=e12]: 注册 VibeAI 账户，开始创作
  - generic [ref=e14]:
    - generic [ref=e15]:
      - text: 昵称
      - textbox "昵称" [ref=e16]:
        - /placeholder: 你的昵称
    - generic [ref=e17]:
      - text: 邮箱
      - textbox "邮箱" [ref=e18]:
        - /placeholder: name@example.com
        - text: e2e-1785724549209@example.com
    - generic [ref=e19]:
      - text: 密码
      - generic [ref=e20]:
        - textbox "密码" [ref=e21]:
          - /placeholder: 至少 8 位，包含字母和数字
        - button [ref=e22]
    - generic [ref=e26]:
      - text: 确认密码
      - textbox "确认密码" [active] [ref=e27]:
        - /placeholder: 再次输入密码
        - text: TestPass123!
    - button "创建账户" [ref=e28]
  - paragraph [ref=e30]:
    - text: 已有账户？
    - link "立即登录" [ref=e31] [cursor=pointer]:
      - /url: /login
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('认证流程', () => {
  4  |   const testEmail = `e2e-${Date.now()}@example.com`;
  5  |   const testPassword = 'TestPass123!';
  6  | 
  7  |   test('注册新用户', async ({ page }) => {
  8  |     await page.goto('/register');
  9  | 
  10 |     await page.fill('input[type="email"]', testEmail);
  11 |     await page.fill('input[placeholder*="密码"]', testPassword);
> 12 |     await page.fill('input[placeholder*="姓名"]', 'E2E User');
     |                ^ Error: page.fill: Test timeout of 60000ms exceeded.
  13 |     await page.click('button[type="submit"]');
  14 | 
  15 |     // 注册成功后应跳转到首页
  16 |     await page.waitForURL(/\/dashboard/);
  17 |     await expect(page.locator('text=VibeAI')).toBeVisible();
  18 |   });
  19 | 
  20 |   test('登出并重新登录', async ({ page }) => {
  21 |     // 先登录
  22 |     await page.goto('/login');
  23 |     await page.fill('input[type="email"]', 'admin@vibeai.com');
  24 |     await page.fill('input[placeholder*="密码"]', 'admin123456');
  25 |     await page.click('button[type="submit"]');
  26 |     await page.waitForURL(/\/dashboard/);
  27 | 
  28 |     // 登出（通过 settings 或导航栏）
  29 |     await page.goto('/settings');
  30 |     await page.waitForLoadState('networkidle');
  31 | 
  32 |     // 重新登录
  33 |     await page.goto('/login');
  34 |     await page.fill('input[type="email"]', 'admin@vibeai.com');
  35 |     await page.fill('input[placeholder*="密码"]', 'admin123456');
  36 |     await page.click('button[type="submit"]');
  37 |     await page.waitForURL(/\/dashboard/);
  38 |     await expect(page.locator('text=VibeAI')).toBeVisible();
  39 |   });
  40 | 
  41 |   test('无效凭证登录失败', async ({ page }) => {
  42 |     await page.goto('/login');
  43 |     await page.fill('input[type="email"]', 'wrong@example.com');
  44 |     await page.fill('input[placeholder*="密码"]', 'wrongpass');
  45 |     await page.click('button[type="submit"]');
  46 | 
  47 |     // 应显示错误提示且留在登录页
  48 |     await expect(page.locator('text=邮箱或密码错误').or(page.locator('text=登录失败'))).toBeVisible();
  49 |     await expect(page).toHaveURL(/\/login/);
  50 |   });
  51 | });
```