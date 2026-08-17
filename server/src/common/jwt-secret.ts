/**
 * JWT 密钥安全辅助
 *
 * 问题背景: 历史上 auth.service.ts / auth.module.ts 中有多处
 * `process.env.JWT_SECRET || 'vibeai-jwt-secret-key-2024'` 之类的
 * 硬编码兜底。一旦生产环境未配置 JWT_SECRET（或使用占位值），
 * 攻击者可直接用公开密钥伪造任意用户/管理员 JWT。
 *
 * 两层防护:
 * 1. assertJwtSecretConfigured() — 启动时 fail-fast（main.ts 调用）
 * 2. getJwtSecret() — 运行时兜底（模块/服务调用），生产环境再次拦截
 */
export const KNOWN_WEAK_SECRETS = new Set([
  'vibeai-jwt-secret-key-change-in-production',
  'vibeai-jwt-secret-key-2024',
  'vibeai-dev-jwt-secret-key-2026',
  'vibeai-production-jwt-secret-change-me',
]);

const DEV_FALLBACK = 'vibeai-dev-jwt-secret-key-2026';

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function isWeakSecret(secret: string | undefined): boolean {
  return !secret || KNOWN_WEAK_SECRETS.has(secret) || secret.trim().length < 16;
}

/**
 * 启动时校验（fail-fast）。生产环境 JWT_SECRET 缺失或为弱密钥时抛出异常。
 */
export function assertJwtSecretConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProduction(env)) return;
  if (isWeakSecret(env.JWT_SECRET)) {
    throw new Error(
      '[security] 生产环境必须配置强 JWT_SECRET（当前缺失或为默认/占位/过短密钥），拒绝启动。' +
        '请设置：JWT_SECRET="$(openssl rand -base64 32)"',
    );
  }
}

/**
 * 运行时获取 JWT_SECRET。
 * - 生产环境：缺失/弱密钥 → 抛错（防硬编码兜底被利用）
 * - 开发环境：允许开发兜底密钥
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (isWeakSecret(env.JWT_SECRET)) {
    if (isProduction(env)) {
      throw new Error(
        '[security] 生产环境 JWT_SECRET 缺失或为弱密钥，拒绝签名/验证 Token。请配置强随机 JWT_SECRET。',
      );
    }
    return DEV_FALLBACK;
  }
  return env.JWT_SECRET as string;
}
