/**
 * cors.config 白名单解析单元测试
 *
 * 覆盖：
 * - 逗号分隔白名单 → 数组
 * - 显式 * → 保留
 * - 未配置：生产 false（同源）/ 开发 true（宽松）
 * - 空白/尾随逗号清理
 */
import { describe, it, expect } from 'vitest';
import { resolveCorsOrigin } from './cors.config';

describe('resolveCorsOrigin', () => {
  it('逗号分隔白名单应解析为数组（去除空白）', () => {
    expect(resolveCorsOrigin({ CORS_ORIGIN: 'https://a.com, https://b.com' })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('白名单中的空项应被过滤', () => {
    expect(resolveCorsOrigin({ CORS_ORIGIN: 'https://a.com,,,https://b.com,' })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('显式 * 应保留', () => {
    expect(resolveCorsOrigin({ CORS_ORIGIN: '*' })).toBe('*');
  });

  it('未配置 + 生产环境 → false（仅同源）', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
  });

  it('未配置 + 开发环境 → true（宽松）', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'development' })).toBe(true);
    expect(resolveCorsOrigin({})).toBe(true);
  });
});
