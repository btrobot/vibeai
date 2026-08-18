/**
 * AuthController 限流配置回归测试
 *
 * 背景（fix 3550269 + 后续全局修复）：@nestjs/throttler v6 对无 @Throttle 覆盖的
 * 路由会检查全部 named throttlers，导致 me/refresh/projects/notifications 等
 * 所有未覆盖路由被 auth(5/min)/generation(10/min)/upload(20/min) 共同计数，
 * 频繁刷新页面即触发 429（"有时有，有时无"、创建失败）。
 *
 * 全局修复方案：forRoot 仅保留 default(100/min)，业务限流通过
 * @Throttle({ default: { limit } }) 按路由覆盖（v6 storage key 含路由路径，天然隔离）。
 *
 * 本测试锁定配置契约：
 * - 非暴力破解端点（me/refresh/logout/change-password/oauth）：无任何
 *   Throttle/SkipThrottle 元数据，仅受全局 default(100/min) 限制
 * - 暴力破解端点（register/login/forgot/reset）：default limit = 10（防爆破），
 *   且未被 SkipThrottle 跳过
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
const SKIP_DEFAULT = 'THROTTLER:SKIPdefault';

// 已修复：应无任何限流覆盖，天然仅受全局 default(100/min)
const NON_BRUTE_FORCE_METHODS = [
  'refresh',
  'logout',
  'getProfile',
  'updateProfile',
  'changePassword',
  'oauthRedirect',
  'oauthCallback',
] as const;

// 应保持防爆破：default limit 10/min（2026-08 从 5/min 上调：配合 trust proxy 修复后
// 按真实客户端 IP 计数，10/min 仍可防爆破，同时给真实用户误触/多设备留余量）
const BRUTE_FORCE_METHODS = ['register', 'login', 'forgotPassword', 'resetPassword'] as const;

describe('AuthController 限流配置', () => {
  it('me/refresh/logout 等端点无限流覆盖，仅受全局 default(100/min)', () => {
    for (const method of NON_BRUTE_FORCE_METHODS) {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler), `${method} 不应有 default limit 覆盖`).toBeUndefined();
      expect(Reflect.getMetadata(SKIP_DEFAULT, handler), `${method} 不应被跳过`).toBeUndefined();
    }
  });

  it('register/login/forgot/reset 通过 default 覆盖为 10/min 防爆破，未被跳过', () => {
    for (const method of BRUTE_FORCE_METHODS) {
      const handler = AuthController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler), `${method} 应有 default limit=10`).toBe(10);
      expect(Reflect.getMetadata(SKIP_DEFAULT, handler), `${method} 不应被跳过`).toBeUndefined();
    }
  });
});
