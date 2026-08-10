import { describe, it, expect, beforeEach } from 'vitest';
import { AdminService } from './admin.service';
import { createDrizzleMock, mockSingle, mockMany, mockEmpty } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new AdminService(db as any);
  });

  // ===== getStats =====

  describe('getStats', () => {
    it('should return aggregated platform statistics', async () => {
      db._result = [{ value: 42 }];
      const stats = await service.getStats();
      expect(stats.totalUsers).toBe(42);
      expect(stats.activeUsers).toBe(42);
      expect(stats.totalProjects).toBe(42);
      expect(stats.totalTasks).toBe(42);
      expect(stats.failedTasks).toBe(42);
      expect(stats.totalStorage).toBe(42);
      expect(stats.totalGalleryWorks).toBe(42);
      expect(stats.publishedGalleryWorks).toBe(42);
      expect(stats.totalCreditsInCirculation).toBe(42);
      expect(stats.bannedUsers).toBe(42);
    });

    it('should return zero values when no data exists', async () => {
      db._result = [{ value: 0 }];
      const stats = await service.getStats();
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalStorage).toBe(0);
      expect(stats.totalGalleryWorks).toBe(0);
      expect(stats.totalCreditsInCirculation).toBe(0);
      expect(stats.bannedUsers).toBe(0);
    });
  });

  // ===== getUsers =====

  describe('getUsers', () => {
    it('should return paginated user list', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@test.com', name: 'A', avatar: null, role: 'user', credits: 100, isActive: true, isEmailVerified: true, lastLoginAt: null, createdAt: new Date() },
        { id: 'u2', email: 'b@test.com', name: 'B', avatar: null, role: 'user', credits: 50, isActive: true, isEmailVerified: false, lastLoginAt: null, createdAt: new Date() },
      ];
      mockMany(db, mockUsers);
      const result = await service.getUsers(1, 20);
      expect(result.users).toHaveLength(2);
      expect(result.users[0].email).toBe('a@test.com');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should accept search parameter', async () => {
      mockMany(db, [{ id: 'u1', email: 'found@test.com', name: 'Found', avatar: null, role: 'user', credits: 0, isActive: true, isEmailVerified: false, lastLoginAt: null, createdAt: new Date() }]);
      const result = await service.getUsers(1, 20, 'found');
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('found@test.com');
    });

    it('should return empty when no users', async () => {
      mockEmpty(db);
      const result = await service.getUsers(1, 20);
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ===== banUser =====

  describe('banUser', () => {
    it('should ban an active user and return user info', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: true, role: 'user' });
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: false });
      const result = await service.banUser('u1');
      expect(result.id).toBe('u1');
      expect(result.email).toBe('user@test.com');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.banUser('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when banning an admin', async () => {
      mockSingle(db, { id: 'u1', isActive: true, role: 'admin' });
      await expect(service.banUser('u1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when user already banned', async () => {
      mockSingle(db, { id: 'u1', isActive: false, role: 'user' });
      await expect(service.banUser('u1')).rejects.toThrow(BadRequestException);
    });
  });

  // ===== unbanUser =====

  describe('unbanUser', () => {
    it('should unban a banned user and return user info', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: false, role: 'user' });
      mockSingle(db, { id: 'u1', email: 'user@test.com', isActive: true });
      const result = await service.unbanUser('u1');
      expect(result.id).toBe('u1');
      expect(result.email).toBe('user@test.com');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.unbanUser('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not banned', async () => {
      mockSingle(db, { id: 'u1', isActive: true });
      await expect(service.unbanUser('u1')).rejects.toThrow(BadRequestException);
    });
  });

  // ===== updateUserRole =====

  describe('updateUserRole', () => {
    it('should update user role to admin', async () => {
      mockSingle(db, { id: 'u1', email: 'user@test.com', role: 'user' });
      mockSingle(db, { id: 'u1', email: 'user@test.com', role: 'admin' });
      const result = await service.updateUserRole('u1', 'admin');
      expect(result.id).toBe('u1');
      expect(result.email).toBe('user@test.com');
    });

    it('should update user role to user', async () => {
      mockSingle(db, { id: 'u1', email: 'admin@test.com', role: 'admin' });
      mockSingle(db, { id: 'u1', email: 'admin@test.com', role: 'user' });
      const result = await service.updateUserRole('u1', 'user');
      expect(result.id).toBe('u1');
    });

    it('should throw BadRequestException for invalid role', async () => {
      await expect(service.updateUserRole('u1', 'superadmin')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when role is unchanged', async () => {
      mockSingle(db, { id: 'u1', role: 'user' });
      await expect(service.updateUserRole('u1', 'user')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockEmpty(db);
      await expect(service.updateUserRole('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getGalleryWorks =====

  describe('getGalleryWorks', () => {
    it('should return paginated gallery works', async () => {
      const mockWorks = [
        { id: 'w1', userId: 'u1', title: 'Art 1', type: 'image', prompt: 'test', modelSlug: 'sdxl', isPublished: true, likes: 10, views: 100, createdAt: new Date() },
        { id: 'w2', userId: 'u2', title: 'Art 2', type: 'video', prompt: 'test2', modelSlug: 'kling', isPublished: false, likes: 5, views: 50, createdAt: new Date() },
      ];
      mockMany(db, mockWorks);
      const result = await service.getGalleryWorks(1, 20);
      expect(result.works).toHaveLength(2);
      expect(result.works[0].title).toBe('Art 1');
    });

    it('should filter by published status', async () => {
      mockMany(db, [{ id: 'w1', userId: 'u1', title: 'Published', type: 'image', prompt: null, modelSlug: null, isPublished: true, likes: 0, views: 0, createdAt: new Date() }]);
      const result = await service.getGalleryWorks(1, 20, 'published');
      expect(result.works).toHaveLength(1);
      expect(result.works[0].isPublished).toBe(true);
    });

    it('should return empty when no works', async () => {
      mockEmpty(db);
      const result = await service.getGalleryWorks(1, 20);
      expect(result.works).toHaveLength(0);
    });
  });

  // ===== unpublishWork =====

  describe('unpublishWork', () => {
    it('should unpublish a published work', async () => {
      mockSingle(db, { id: 'w1', title: 'Art 1', isPublished: true });
      mockSingle(db, { id: 'w1', title: 'Art 1', isPublished: false });
      const result = await service.unpublishWork('w1');
      expect(result.id).toBe('w1');
      expect(result.title).toBe('Art 1');
    });

    it('should throw NotFoundException if work does not exist', async () => {
      mockEmpty(db);
      await expect(service.unpublishWork('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when work is already unpublished', async () => {
      mockSingle(db, { id: 'w1', isPublished: false });
      await expect(service.unpublishWork('w1')).rejects.toThrow(BadRequestException);
    });
  });

  // ===== deleteWork =====

  describe('deleteWork', () => {
    it('should delete an existing work', async () => {
      mockSingle(db, { id: 'w1' });
      const result = await service.deleteWork('w1');
      expect(result.id).toBe('w1');
      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException if work does not exist', async () => {
      mockEmpty(db);
      await expect(service.deleteWork('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
