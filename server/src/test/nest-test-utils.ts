import { vi } from 'vitest';
import { createDrizzleMock } from './drizzle-mock';

/**
 * NestJS 测试模块工厂
 *
 * 提供快速创建 NestJS 测试模块的辅助函数，
 * 自动注入 Mock Drizzle Provider。
 */

export const DRIZZLE = 'DRIZZLE';

export function createMockDrizzleProvider() {
  return {
    provide: DRIZZLE,
    useValue: createDrizzleMock(),
  };
}

/**
 * 创建完整的 NestJS 测试模块配置
 * 包含默认的 Mock Drizzle Provider
 */
export function createTestingModuleConfig(imports: any[] = [], providers: any[] = []) {
  return {
    imports: [...imports],
    providers: [createMockDrizzleProvider(), ...providers],
  };
}

/**
 * 模拟 JwtService
 */
export function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ sub: '1', email: 'test@vibeai.com' }),
    verifyAsync: vi.fn().mockResolvedValue({ sub: '1', email: 'test@vibeai.com' }),
    decode: vi.fn().mockReturnValue({ sub: '1', email: 'test@vibeai.com' }),
  };
}

/**
 * 模拟 Bcrypt（密码哈希）
 */
export function createMockBcrypt() {
  return {
    hash: vi.fn().mockResolvedValue('$2b$10$mockhashedpassword'),
    compare: vi.fn().mockImplementation(
      (plain: string, hash: string) => Promise.resolve(plain === 'correct-password'),
    ),
  };
}