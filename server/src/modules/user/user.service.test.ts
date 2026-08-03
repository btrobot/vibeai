import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';
import { buildUser } from '../../test/factories';

describe('UserService', () => {
  let service: UserService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new UserService(db as any);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const user = buildUser({ id: 'user-1', name: '测试用户', credits: 500 });
      db._result = [user];

      const result = await service.findById('user-1');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('user-1');
      expect(result.data.name).toBe('测试用户');
      expect(result.data.credits).toBe(500);
    });

    it('should throw NotFoundException when user not found', async () => {
      db._result = [];
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const user = buildUser({ email: 'test@vibeai.com' });
      db._result = [user];

      const result = await service.findByEmail('test@vibeai.com');
      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@vibeai.com');
    });

    it('should return null when email not found', async () => {
      db._result = [];
      const result = await service.findByEmail('nonexistent@test.com');
      expect(result).toBeNull();
    });
  });
});