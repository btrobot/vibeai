/**
 * Zod Schema 验证测试（100% 覆盖目标）
 *
 * 测试所有共享 Zod Schema 的：
 * - 有效输入应通过验证
 * - 无效输入应返回合理错误信息
 * - 边界值处理
 */

import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  GenerationRequestSchema,
  CreateSubscriptionSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  FileCategorySchema,
} from '../../shared/index';

describe('RegisterSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'Password123',
    name: 'Test User',
  };

  it('应该通过有效注册数据', () => {
    const result = RegisterSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('应该拒绝无效邮箱', () => {
    const result = RegisterSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email');
    }
  });

  it('应该拒绝过短密码（< 8位）', () => {
    const result = RegisterSchema.safeParse({ ...validInput, password: 'Ab1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('password');
    }
  });

  it('应该拒绝纯数字密码', () => {
    const result = RegisterSchema.safeParse({ ...validInput, password: '12345678' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/字母/i);
    }
  });

  it('应该拒绝纯字母密码', () => {
    const result = RegisterSchema.safeParse({ ...validInput, password: 'abcdefgh' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/数字/i);
    }
  });

  it('应该拒绝过短昵称', () => {
    const result = RegisterSchema.safeParse({ ...validInput, name: 'A' });
    expect(result.success).toBe(false);
  });

  it('应该拒绝过长昵称', () => {
    const result = RegisterSchema.safeParse({ ...validInput, name: 'A'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('应该拒绝空邮箱', () => {
    const result = RegisterSchema.safeParse({ ...validInput, email: '' });
    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'any-password',
  };

  it('应该通过有效登录数据', () => {
    const result = LoginSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('应该拒绝无效邮箱', () => {
    const result = LoginSchema.safeParse({ ...validInput, email: '' });
    expect(result.success).toBe(false);
  });

  it('应该拒绝空密码', () => {
    const result = LoginSchema.safeParse({ ...validInput, password: '' });
    expect(result.success).toBe(false);
  });
});

describe('RefreshTokenSchema', () => {
  it('应该通过有效刷新令牌', () => {
    const result = RefreshTokenSchema.safeParse({ refreshToken: 'some-token' });
    expect(result.success).toBe(true);
  });

  it('应该拒绝空刷新令牌', () => {
    const result = RefreshTokenSchema.safeParse({ refreshToken: '' });
    expect(result.success).toBe(false);
  });
});

describe('GenerationRequestSchema', () => {
  const validInput = {
    capabilitySlug: 'text_to_image',
    input: { prompt: 'test' },
  };

  it('应该通过有效生成请求', () => {
    const result = GenerationRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('应该拒绝空能力标识', () => {
    const result = GenerationRequestSchema.safeParse({ ...validInput, capabilitySlug: '' });
    expect(result.success).toBe(false);
  });
});

describe('CreateSubscriptionSchema', () => {
  it('应该通过有效套餐 slug', () => {
    ['free', 'starter', 'pro', 'enterprise'].forEach((slug) => {
      const result = CreateSubscriptionSchema.safeParse({ planSlug: slug });
      expect(result.success).toBe(true);
    });
  });

  it('应该拒绝无效套餐 slug', () => {
    const result = CreateSubscriptionSchema.safeParse({ planSlug: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('应该默认使用月度计费', () => {
    const result = CreateSubscriptionSchema.parse({ planSlug: 'free' });
    expect(result.billingCycle).toBe('monthly');
  });
});

describe('CreateProjectSchema', () => {
  it('应该通过有效项目数据', () => {
    const result = CreateProjectSchema.safeParse({ name: 'My Project' });
    expect(result.success).toBe(true);
  });

  it('应该拒绝空项目名称', () => {
    const result = CreateProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('应该拒绝过长项目名称', () => {
    const result = CreateProjectSchema.safeParse({ name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('应该接受可选字段', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Project',
      description: 'A description',
      tags: ['tag1', 'tag2'],
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateProjectSchema', () => {
  it('应该允许部分更新', () => {
    const result = UpdateProjectSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('应该允许空对象（无更新）', () => {
    const result = UpdateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('FileCategorySchema', () => {
  const validCategories = ['image', 'video', 'audio', 'document', 'temp', 'private', 'asset', 'backup'];

  it('应该通过所有有效分类', () => {
    validCategories.forEach((cat) => {
      expect(FileCategorySchema.safeParse(cat).success).toBe(true);
    });
  });

  it('应该拒绝无效分类', () => {
    expect(FileCategorySchema.safeParse('invalid').success).toBe(false);
  });
});