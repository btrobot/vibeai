/**
 * jwt-secret 安全辅助单元测试
 *
 * 覆盖：
 * - 生产环境缺失/占位/过短密钥 → 抛错（fail-fast + 运行时双保险）
 * - 生产环境强密钥 → 正常返回
 * - 开发环境缺失 → 允许开发兜底
 */
import { describe, it, expect } from 'vitest';
import { assertJwtSecretConfigured, getJwtSecret, isWeakSecret } from './jwt-secret';

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'production', ...overrides };
}

describe('isWeakSecret', () => {
  it('空值视为弱密钥', () => {
    expect(isWeakSecret(undefined)).toBe(true);
    expect(isWeakSecret('')).toBe(true);
  });

  it('已知占位/默认密钥视为弱密钥', () => {
    expect(isWeakSecret('vibeai-production-jwt-secret-change-me')).toBe(true);
    expect(isWeakSecret('vibeai-jwt-secret-key-2024')).toBe(true);
    expect(isWeakSecret('vibeai-dev-jwt-secret-key-2026')).toBe(true);
  });

  it('过短密钥（<16 字符）视为弱密钥', () => {
    expect(isWeakSecret('short')).toBe(true);
  });

  it('强随机密钥不算弱', () => {
    expect(isWeakSecret('c29tZS1yYW5kb20tc2VjcmV0LXdpdGgtbW9yZS1sZW5ndGg')).toBe(false);
  });
});

describe('assertJwtSecretConfigured', () => {
  it('生产环境缺失 JWT_SECRET 应抛错', () => {
    expect(() => assertJwtSecretConfigured(env({}))).toThrow(/JWT_SECRET/);
  });

  it('生产环境占位密钥应抛错', () => {
    expect(() => assertJwtSecretConfigured(env({ JWT_SECRET: 'vibeai-production-jwt-secret-change-me' }))).toThrow(/JWT_SECRET/);
  });

  it('生产环境强密钥不抛错', () => {
    expect(() => assertJwtSecretConfigured(env({ JWT_SECRET: 'a-strong-random-secret-0123456789abcdef' }))).not.toThrow();
  });

  it('非生产环境跳过校验', () => {
    expect(() => assertJwtSecretConfigured({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertJwtSecretConfigured({})).not.toThrow();
  });
});

describe('getJwtSecret', () => {
  it('生产环境缺失密钥应抛错（运行时兜底）', () => {
    expect(() => getJwtSecret(env({}))).toThrow(/JWT_SECRET/);
  });

  it('生产环境强密钥正常返回', () => {
    expect(getJwtSecret(env({ JWT_SECRET: 'strong-secret-value-abc123' }))).toBe('strong-secret-value-abc123');
  });

  it('开发环境缺失密钥返回开发兜底', () => {
    expect(getJwtSecret({ NODE_ENV: 'development' })).toBe('vibeai-dev-jwt-secret-key-2026');
  });
});
