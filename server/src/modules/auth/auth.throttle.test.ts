/**
 * AuthController 限流配置回归测试
 *
 * 背景（fix 3550269）：@nestjs/throttler v6 对无 @Throttle 覆盖的路由会检查全部
 * named throttlers，导致 /auth/me、/auth/refresh、/auth/logout 等端点被
 * auth(5/min) 意外限制 —— 连续请求返回 429（非 401 不触发刷新）→ 前端清 token
 * → 刷新页面误跳登录页。
 *
 * 本测试锁定配置契约：
 * - 非暴力破解端点（me/refresh/logout/change-password/oauth）：仅受 default 100/min
 *   限制，排除 auth/generation/upload
 * - 暴力破解端点（register/login/forgot/reset）：保持 auth 5/min 防爆破
 *
 * 元数据 key 来自 @nestjs/throttler 的 throttler.constants：
 *   THROTTLER_LIMIT = 'THROTTLER:LIMIT'、THROTTLER_SKIP = 'THROTTLER:SKIP'
 *   （注意：拼接 throttler name 时无分隔符，如 'THROTTLER:LIMITdefault'）
 *   3 参数形式定义在方法上。
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { AuthController } from './auth.controller';

const LIMIT_DEFAULT = 'THROTTLER:LIMITdefault';
const LIMIT_AUTH = 'THROTTLER:LIMITauth';
const SKIP_AUTH = 'THROTTLER:SKIPauth';
const SKIP_GENERATION = 'THROTTLER:SKIPgeneration';
const SKIP_UPLOAD = 'THROTTLER:SKIPupload';

// 已修复：应排除 auth/generation/upload 误伤，仅受 default 100/min 限制
const NON_BRUTE_FORCE_METHODS = [
  'refresh',
  'logout',
  'getProfile',
  'updateProfile',
  'changePassword',
  'oauthRedirect',
  'oauthCallback',
] as const;

// 应保持防爆破：auth 5/min
const BRUTE_FORCE_METHODS = ['register', 'login', 'forgotPassword', 'resetPassword'] as const;

describe('AuthController 限流配置', () => {
  it('me/refresh/logout 等端点排除 auth(5/min) 误伤，仅受 default(100/min)', () => {
    for (const method of NON_BRUTE_FORCE_METHODS) {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler), `${method} 应有 default limit`).toBe(100);
      expect(Reflect.getMetadata(SKIP_AUTH, handler), `${method} 应跳过 auth`).toBe(true);
      expect(Reflect.getMetadata(SKIP_GENERATION, handler), `${method} 应跳过 generation`).toBe(true);
      expect(Reflect.getMetadata(SKIP_UPLOAD, handler), `${method} 应跳过 upload`).toBe(true);
    }
  });

  it('register/login/forgot/reset 保持 auth(5/min) 防爆破，未被跳过', () => {
    for (const method of BRUTE_FORCE_METHODS) {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_AUTH, handler), `${method} 应有 auth limit`).toBe(5);
      expect(Reflect.getMetadata(SKIP_AUTH, handler), `${method} 不应跳过 auth`).toBeUndefined();
    }
  });

  it('防爆破端点未被误加 default 覆盖（保持纯 auth 限制）', () => {
    for (const method of BRUTE_FORCE_METHODS) {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler), `${method} 不应有 default limit 覆盖`).toBeUndefined();
    }
  });
});
