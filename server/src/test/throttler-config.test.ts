/**
 * 全局限流配置回归测试
 *
 * 背景（fix 4af938b）：@nestjs/throttler v6 对无 @Throttle 覆盖的路由会检查全部
 * named throttlers。此前 forRoot 注册了 default(100)/auth(5)/generation(10)/
 * upload(20) 四个命名限流器，导致 /api/projects、/api/notifications/unread-count
 * 等所有未覆盖路由被 auth(5/min) 共同计数 —— 频繁刷新页面即 429
 * （"有时有，有时无"、创建/删除失败、NotificationBell 报错）。
 *
 * 修复方案：forRoot 仅保留 default(100/min)，业务限流通过
 * @Throttle({ default: { limit } }) 按路由覆盖（v6 storage key 含路由路径，隔离）。
 *
 * 本测试锁定配置契约，防止以下回归：
 * 1. forRoot 重新引入 auth/generation/upload 命名限流器（全局误伤）
 * 2. 业务路由限流值被改动（gateway 10/min、storage 20/min、auth 10/min）
 * 3. 高频业务路由（projects/notifications）被误加 @Throttle 覆盖
 *
 * 元数据 key：THROTTLER:LIMIT + throttler name（无分隔符），见
 * @nestjs/throttler 的 throttler.constants；3 参数形式定义在方法上。
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { AppModule } from '../app.module';
import { GatewayController } from '../modules/gateway/gateway.controller';
import { StorageController } from '../modules/storage/storage.controller';
import { ProjectController } from '../modules/project/project.controller';
import { NotificationController } from '../modules/notification/notification.controller';
import { AuthController } from '../modules/auth/auth.controller';

const LIMIT_DEFAULT = 'THROTTLER:LIMITdefault';
const THROTTLER_OPTIONS = 'THROTTLER:MODULE_OPTIONS';

/** 从 AppModule imports 中反射 ThrottlerModule.forRoot 的配置数组 */
function getThrottlerOptions(): { name: string; ttl: number; limit: number }[] {
  const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
  const throttlerModule = imports.find(
    (m) => typeof m === 'object' && m !== null && (m as { module?: { name?: string } }).module?.name === 'ThrottlerModule',
  ) as { providers: { provide: string; useValue: unknown }[] } | undefined;
  expect(throttlerModule, 'AppModule 应导入 ThrottlerModule（forRoot）').toBeDefined();
  const optProvider = throttlerModule!.providers.find((p) => p.provide === THROTTLER_OPTIONS);
  expect(optProvider, 'ThrottlerModule 应注册 THROTTLER:MODULE_OPTIONS provider').toBeDefined();
  return optProvider!.useValue as { name: string; ttl: number; limit: number }[];
}

describe('全局限流配置', () => {
  it('forRoot 仅注册 default(100/min)，不得引入 auth/generation/upload 命名限流器', () => {
    const options = getThrottlerOptions();

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ name: 'default', ttl: 60_000, limit: 100 });

    const names = options.map((o) => o.name);
    expect(names).not.toContain('auth');
    expect(names).not.toContain('generation');
    expect(names).not.toContain('upload');
  });

  it('gateway 生成类路由覆盖为 default(10/min)，防资源滥用', () => {
    for (const method of ['generate', 'quickCreate', 'chat'] as const) {
      const handler = GatewayController.prototype[method];
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler), `${method} 应为 default limit=10`).toBe(10);
    }
  });

  it('storage 上传路由覆盖为 default(20/min)', () => {
    expect(Reflect.getMetadata(LIMIT_DEFAULT, StorageController.prototype.uploadFile)).toBe(20);
  });

  it('auth 防爆破路由覆盖为 default(10/min)', () => {
    // 与 auth.throttle.test.ts 保持一致的契约（此处统一视角再锁一遍）
    for (const method of ['register', 'login', 'forgotPassword', 'resetPassword'] as const) {
      expect(Reflect.getMetadata(LIMIT_DEFAULT, AuthController.prototype[method]), `${method} 应为 default limit=10`).toBe(10);
    }
  });

  it('高频业务路由（projects/notifications）无 @Throttle 覆盖，仅受全局 default(100/min)', () => {
    const unprotected = [
      ProjectController.prototype.list,
      NotificationController.prototype.list,
      NotificationController.prototype.unreadCount,
    ];
    for (const handler of unprotected) {
      expect(Reflect.getMetadata(LIMIT_DEFAULT, handler)).toBeUndefined();
    }
  });
});
