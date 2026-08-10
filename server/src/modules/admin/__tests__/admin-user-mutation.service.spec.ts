import { describe, it, expect, beforeEach } from 'vitest';
import { AdminUserMutationService } from '../services/admin-user-mutation.service';
import { createDrizzleMock, mockSingle, mockEmpty } from '../../../test/drizzle-mock';
import type { DrizzleMock } from '../../../test/drizzle-mock';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AdminUserMutationService', () => {
  let service: AdminUserMutationService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new AdminUserMutationService(db as any);
  });

  // ===== banUser =====

  describe('banUser', () => {
    it('should ban an active user and return user info', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: true, role: 'user' });
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: false });
      const result = await service.banUser('u1');

      expect(result.id).toBe('u1');
      expect(result.email).toBe('user@test.com');
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.banUser('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.banUser('nonexistent')).rejects.toThrow('用户不存在');
    });

    it('should throw ForbiddenException when banning an admin', async () => {
      mockSingle(db, { id: 'u1', isActive: true, role: 'admin' });
      await expect(service.banUser('u1')).rejects.toThrow(ForbiddenException);
      mockSingle(db, { id: 'u1', isActive: true, role: 'admin' });
      await expect(service.banUser('u1')).rejects.toThrow('不能封禁管理员账户');
    });

    it('should throw BadRequestException when user already banned', async () => {
      mockSingle(db, { id: 'u1', isActive: false, role: 'user' });
      await expect(service.banUser('u1')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'u1', isActive: false, role: 'user' });
      await expect(service.banUser('u1')).rejects.toThrow('用户已被封禁');
    });
  });

  // ===== unbanUser =====

  describe('unbanUser', () => {
    it('should unban a banned user', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: false });
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: true });
      const result = await service.unbanUser('u1');

      expect(result.id).toBe('u1');
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.unbanUser('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not banned', async () => {
      mockSingle(db, { id: 'u1', isActive: true });
      await expect(service.unbanUser('u1')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'u1', isActive: true });
      await expect(service.unbanUser('u1')).rejects.toThrow('用户未被封禁');
    });
  });

  // ===== updateUserRole =====

  describe('updateUserRole', () => {
    it('should update user role to admin', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', role: 'user' });
      mockSingle(db, { id: 'u1', email: 'user@test.com', role: 'admin' });
      const result = await service.updateUserRole('u1', 'admin');

      expect(result.id).toBe('u1');
      expect(result.role).toBe('admin');
    });

    it('should update user role to user', async () => {
      mockSingle(db, { id: 'u1', email: 'admin@test.com', role: 'admin' });
      mockSingle(db, { id: 'u1', email: 'admin@test.com', role: 'user' });
      const result = await service.updateUserRole('u1', 'user');

      expect(result.role).toBe('user');
    });

    it('should throw BadRequestException for invalid role', async () => {
      mockSingle(db, { id: 'u1', role: 'user' });
      await expect(service.updateUserRole('u1', 'invalid')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'u1', role: 'user' });
      await expect(service.updateUserRole('u1', 'invalid')).rejects.toThrow('角色只能是 user 或 admin');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.updateUserRole('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when role is already set', async () => {
      mockSingle(db, { id: 'u1', role: 'admin' });
      await expect(service.updateUserRole('u1', 'admin')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'u1', role: 'admin' });
      await expect(service.updateUserRole('u1', 'admin')).rejects.toThrow('用户角色已为 admin');
    });
  });

  // ===== unpublishWork =====

  describe('unpublishWork', () => {
    it('should unpublish a published work', async () => {
      mockSingle(db, { id: 'w1', title: 'Test Work', isPublished: true });
      mockSingle(db, { id: 'w1', title: 'Test Work', isPublished: false });
      const result = await service.unpublishWork('w1');

      expect(result.id).toBe('w1');
      expect(result.isPublished).toBe(false);
    });

    it('should throw NotFoundException if work does not exist', async () => {
      mockEmpty(db);
      await expect(service.unpublishWork('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.unpublishWork('nonexistent')).rejects.toThrow('作品不存在');
    });

    it('should throw BadRequestException when work already unpublished', async () => {
      mockSingle(db, { id: 'w1', isPublished: false });
      await expect(service.unpublishWork('w1')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'w1', isPublished: false });
      await expect(service.unpublishWork('w1')).rejects.toThrow('作品未发布');
    });
  });

  // ===== deleteWork =====

  describe('deleteWork', () => {
    it('should delete a work', async () => {
      mockSingle(db, { id: 'w1' });
      const result = await service.deleteWork('w1');
      
      expect(result.id).toBe('w1');
      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException if work does not exist', async () => {
      mockEmpty(db);
      await expect(service.deleteWork('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.deleteWork('nonexistent')).rejects.toThrow('作品不存在');
    });
  });

  // ===== createUser =====

  describe('createUser', () => {
    it('should create a new user with default role', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'new@example.com',
        name: 'New User',
        role: 'user',
        credits: 0,
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.createUser({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.id).toBe('u1');
      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('user');
      expect(result.credits).toBe(0);
      expect(result.isActive).toBe(true);
    });

    it('should create a new user with admin role', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        credits: 100,
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.createUser({
        email: 'admin@example.com',
        name: 'Admin User',
        password: 'password123',
        role: 'admin',
        credits: 100,
      });

      expect(result.role).toBe('admin');
      expect(result.credits).toBe(100);
    });
  });

  // ===== updateUser =====

  describe('updateUser', () => {
    it('should update user name', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'user@example.com',
        name: 'Updated Name',
        avatar: null,
        role: 'user',
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.updateUser('u1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update user avatar', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        avatar: 'new-avatar.png',
        role: 'user',
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.updateUser('u1', { avatar: 'new-avatar.png' });

      expect(result.avatar).toBe('new-avatar.png');
    });

    it('should update user role', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        avatar: null,
        role: 'admin',
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.updateUser('u1', { role: 'admin' });

      expect(result.role).toBe('admin');
    });

    it('should update user active status', async () => {
      mockSingle(db, {
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        avatar: null,
        role: 'user',
        isActive: false,
        updatedAt: new Date(),
      });

      const result = await service.updateUser('u1', { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.updateUser('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  // ===== adjustCredits =====

  describe('adjustCredits', () => {
    it('should add credits to user', async () => {
      // 设置初始用户状态（用于查询）
      const initialUser = { id: 'u1', email: 'user@example.com', credits: 100 };
      mockSingle(db, initialUser);
      mockSingle(db, { id: 'u1', email: 'user@example.com', credits: 150 });

      const result = await service.adjustCredits('u1', 50, 'Bonus credits', 'admin-id');

      expect(result.credits).toBe(150);
    });

    it('should deduct credits from user', async () => {
      // 设置初始用户状态（用于查询）
      const initialUser = { id: 'u1', email: 'user@example.com', credits: 100 };
      mockSingle(db, initialUser);
      mockSingle(db, { id: 'u1', email: 'user@example.com', credits: 50 });

      const result = await service.adjustCredits('u1', -50, 'Used credits', 'admin-id');

      expect(result.credits).toBe(50);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.adjustCredits('nonexistent', 50, 'Test', 'admin-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when insufficient credits', async () => {
      mockSingle(db, { id: 'u1', credits: 10 });
      await expect(service.adjustCredits('u1', -50, 'Test', 'admin-id')).rejects.toThrow(BadRequestException);
      mockSingle(db, { id: 'u1', credits: 10 });
      await expect(service.adjustCredits('u1', -50, 'Test', 'admin-id')).rejects.toThrow('余额不足');
    });
  });
});
