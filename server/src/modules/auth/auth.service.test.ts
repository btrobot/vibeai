/**
 * AuthService 单元测试
 *
 * 覆盖范围：
 * - register（成功注册 / 邮箱重复）
 * - login（成功登录 / 密码错误 / 不存在的用户）
 * - refresh（有效令牌 / 过期令牌）
 * - getProfile（获取用户信息）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty, mockReturning } from '../../test/drizzle-mock';
import { createMockJwtService } from '../../test/nest-test-utils';
import { buildUser } from '../../test/factories';
import { DRIZZLE } from '../../common/drizzle.module';

// 模拟 bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;
  let jwtService: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    db = createDrizzleMockForNestJS();
    jwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: db },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@vibeai.com',
      password: 'Password123',
      name: 'New User',
    };

    it('应该成功注册新用户', async () => {
      // limit 首次调用返回 []（无重复），returning 返回新用户
      (db as any).limit.mockResolvedValueOnce([]);
      mockReturning(db, [
        {
          id: 'user-new',
          email: registerDto.email,
          name: registerDto.name,
          password_hash: 'hashed',
          role: 'user' as const,
          avatar_url: null,
          credits_balance: 100,
          is_active: true,
          created_at: new Date(),
        },
      ]);

      const result = await authService.register(registerDto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // register 返回 data 直接是用户对象（无 user 包裹）
      expect(result.data.email).toBe(registerDto.email);
      expect(result.data.name).toBe(registerDto.name);
      expect(result.message).toBe('注册成功');
    });

    it('应该拒绝重复邮箱注册', async () => {
      mockSingle(db, buildUser({ email: registerDto.email }));

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@vibeai.com',
      password: 'correct-password',
    };

    it('应该成功登录有效用户', async () => {
      const user = buildUser({
        email: loginDto.email,
        passwordHash: 'hashed-password',
      });
      mockSingle(db, user);
      // 模拟 bcrypt.compare 返回 true
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login(loginDto, '127.0.0.1', 'test-agent');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // login 返回 data.user 包裹
      expect(result.data.user.email).toBe(loginDto.email);
      expect(result.data.tokens).toBeDefined();
      expect(result.data.tokens.accessToken).toBe('mock-jwt-token');
      expect(result.data.tokens.refreshToken).toBe('mock-jwt-token');
    });

    it('应该拒绝不存在用户的登录', async () => {
      mockEmpty(db);

      await expect(
        authService.login(loginDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该拒绝错误密码', async () => {
      mockSingle(db, buildUser({ email: loginDto.email }));
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.login(loginDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('应该成功刷新有效令牌', async () => {
      mockSingle(db, {
        id: 'session-1',
        user_id: 'user-1',
        refresh_token: 'valid-refresh-token',
        expires_at: new Date(Date.now() + 86400000),
        is_revoked: false,
        created_at: new Date(),
      });
      mockSingle(db, buildUser({ id: 'user-1' }));

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.tokens).toBeDefined();
      expect(result.data.tokens.accessToken).toBe('mock-jwt-token');
    });

    it('应该拒绝过期令牌', async () => {
      mockSingle(db, {
        id: 'session-1',
        user_id: 'user-1',
        refresh_token: 'expired-token',
        expires_at: new Date(Date.now() - 86400000),
        is_revoked: false,
        created_at: new Date(),
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('应该返回用户信息', async () => {
      const user = buildUser({ id: 'user-1' });
      mockSingle(db, user);

      const result = await authService.getProfile('user-1');

      expect(result).toBeDefined();
      // getProfile 返回 { success, data: { id, email, ... } }
      expect(result.data.id).toBe('user-1');
      expect(result.data.email).toBe(user.email);
    });

    it('应该对不存在的用户抛出异常', async () => {
      mockEmpty(db);

      await expect(authService.getProfile('non-existent')).rejects.toThrow(UnauthorizedException);
    });
  });
});