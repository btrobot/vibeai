/**
 * CORS 白名单解析
 *
 * 问题背景: 原 main.ts 使用 `origin: process.env.CORS_ORIGIN || true`，
 * 生产环境未配置 CORS_ORIGIN 时 reflect 任意 Origin（配合 credentials
 * 等于允许任何网站携带凭证跨域请求）。compose 默认 `CORS_ORIGIN=*` 同理。
 *
 * 安全策略:
 * - 配置了白名单（逗号分隔）→ 仅允许列表内 Origin
 * - 显式 `*` → 保留（操作方明确选择；浏览器会拦截带凭证的 * 请求）
 * - 未配置 → 生产环境返回 false（仅同源，NestJS serve 静态文件场景）
 *           开发环境返回 true（宽松，方便本地联调）
 */
export function resolveCorsOrigin(env: NodeJS.ProcessEnv = process.env): string | string[] | boolean {
  const configured = (env.CORS_ORIGIN || '').trim();

  if (configured && configured !== '*') {
    return configured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (configured === '*') {
    return '*';
  }

  // 未配置：生产严格同源，开发宽松
  return env.NODE_ENV === 'production' ? false : true;
}
