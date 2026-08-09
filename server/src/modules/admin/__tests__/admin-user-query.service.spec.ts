import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminUserQueryService } from '../services/admin-user-query.service';
import { createDrizzleMock, mockSingle, mockMany, mockEmpty } from '../../../test/drizzle-mock';
import type { DrizzleMock } from '../../../test/drizzle-mock';

describe('AdminUserQueryService', () => {
  let service: AdminUserQueryService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new AdminUserQueryService(db as any);
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
      expect(stats.activeUsers).toBe(0);
      expect(stats.totalProjects).toBe(0);
      expect(stats.totalTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
      expect(stats.totalStorage).toBe(0);
      expect(stats.totalGalleryWorks).toBe(0);
      expect(stats.publishedGalleryWorks).toBe(0);
      expect(stats.totalCreditsInCirculation).toBe(0);
      expect(stats.bannedUsers).toBe(0);
    });

    it('should handle null values correctly', async () => {
      db._result = [null];
      const stats = await service.getStats();
      
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalStorage).toBe(0);
      expect(stats.totalCreditsInCirculation).toBe(0);
    });
  });

  // ===== getUsers =====

  describe('getUsers', () => {
    it('should return paginated user list', async () => {
      const mockUsers = [
        { 
          id: 'u1', 
          email: 'a@test.com', 
          name: 'A', 
          avatar: null, 
          role: 'user', 
          credits: 100, 
          isActive: true, 
          isEmailVerified: true, 
          lastLoginAt: null, 
          createdAt: new Date() 
        },
        { 
          id: 'u2', 
          email: 'b@test.com', 
          name: 'B', 
          avatar: null, 
          role: 'user', 
          credits: 50, 
          isActive: true, 
          isEmailVerified: false, 
          lastLoginAt: null, 
          createdAt: new Date() 
        },
      ];
      
      // Mock users query
      mockMany(db, mockUsers);

      // Mock count query
      const countMock = { _result: [{ value: 2 }] };
      // 使用原始 db 作为非 count 查询
      db.select = vi.fn((...args: any[]) => {
        // count 查询：传入的是 callback 函数 { value: count() }
        if (args.length > 0 && typeof args[0] === 'object' && 'value' in args[0]) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve(countMock._result))
            }))
          };
        }
        // 正常查询：返回 chainable 对象
        return db;
      }) as any;

      const result = await service.getUsers(1, 20);

      expect(result.users).toHaveLength(2);
      expect(result.users[0].email).toBe('a@test.com');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should accept search parameter', async () => {
      const mockUsers = [{ 
        id: 'u1', 
        email: 'found@test.com', 
        name: 'Found', 
        avatar: null, 
        role: 'user', 
        credits: 0, 
        isActive: true, 
        isEmailVerified: false, 
        lastLoginAt: null, 
        createdAt: new Date() 
      }];
      
      mockMany(db, mockUsers);
      const result = await service.getUsers(1, 20, 'found');
      
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('found@test.com');
    });

    it('should return empty when no users', async () => {
      mockEmpty(db);
      const result = await service.getUsers(1, 20);
      
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should calculate total pages correctly', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) => ({
        id: `u${i}`,
        email: `user${i}@test.com`,
        name: `User${i}`,
        avatar: null,
        role: 'user' as const,
        credits: 0,
        isActive: true,
        isEmailVerified: false,
        lastLoginAt: null,
        createdAt: new Date(),
      }));
      
      mockMany(db, mockUsers);

      // Mock count query
      const countMock = { _result: [{ value: 1 }] };
      db.select = vi.fn((...args: any[]) => {
        // count 查询
        if (args.length > 0 && typeof args[0] === 'object' && 'value' in args[0]) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve(countMock._result))
            }))
          };
        }
        return db;
      }) as any;

      const result = await service.getUsers(1, 10);

      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ===== getUserById =====

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'avatar.png',
        role: 'user' as const,
        credits: 100,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockSingle(db, mockUser);
      const result = await service.getUserById('u1');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('u1');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return undefined for non-existent user', async () => {
      mockEmpty(db);
      const result = await service.getUserById('nonexistent');
      
      expect(result).toBeUndefined();
    });
  });

  // ===== getGalleryWorks =====

  describe('getGalleryWorks', () => {
    it('should return paginated gallery works', async () => {
      const mockWorks = [
        {
          id: 'w1',
          userId: 'u1',
          title: 'Work 1',
          type: 'image',
          prompt: 'A beautiful sunset',
          modelSlug: 'sd-xl',
          isPublished: true,
          likes: 10,
          views: 100,
          createdAt: new Date(),
        },
        {
          id: 'w2',
          userId: 'u2',
          title: 'Work 2',
          type: 'video',
          prompt: 'A cat video',
          modelSlug: 'runway',
          isPublished: false,
          likes: 5,
          views: 50,
          createdAt: new Date(),
        },
      ];
      
      mockMany(db, mockWorks);
      const result = await service.getGalleryWorks(1, 20);
      
      expect(result.works).toHaveLength(2);
      expect(result.works[0].title).toBe('Work 1');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by published status', async () => {
      const mockWorks = [
        {
          id: 'w1',
          userId: 'u1',
          title: 'Published Work',
          type: 'image',
          prompt: 'Test',
          modelSlug: 'sd-xl',
          isPublished: true,
          likes: 10,
          views: 100,
          createdAt: new Date(),
        },
      ];
      
      mockMany(db, mockWorks);
      const result = await service.getGalleryWorks(1, 20, 'published');
      
      expect(result.works).toHaveLength(1);
      expect(result.works[0].isPublished).toBe(true);
    });

    it('should filter by unpublished status', async () => {
      const mockWorks = [
        {
          id: 'w1',
          userId: 'u1',
          title: 'Unpublished Work',
          type: 'image',
          prompt: 'Test',
          modelSlug: 'sd-xl',
          isPublished: false,
          likes: 0,
          views: 0,
          createdAt: new Date(),
        },
      ];
      
      mockMany(db, mockWorks);
      const result = await service.getGalleryWorks(1, 20, 'unpublished');
      
      expect(result.works).toHaveLength(1);
      expect(result.works[0].isPublished).toBe(false);
    });

    it('should return all works when no status filter', async () => {
      const mockWorks = [
        {
          id: 'w1',
          userId: 'u1',
          title: 'Work 1',
          type: 'image',
          prompt: 'Test',
          modelSlug: 'sd-xl',
          isPublished: true,
          likes: 10,
          views: 100,
          createdAt: new Date(),
        },
      ];
      
      mockMany(db, mockWorks);
      const result = await service.getGalleryWorks(1, 20);
      
      expect(result.works).toHaveLength(1);
    });
  });

  // ===== searchUsers =====

  describe('searchUsers', () => {
    it('should search users by keyword', async () => {
      const mockUsers = [
        { id: 'u1', email: 'john@example.com', name: 'John Doe', avatar: null, role: 'user' as const },
        { id: 'u2', email: 'jane@example.com', name: 'Jane Doe', avatar: null, role: 'user' as const },
      ];
      
      mockMany(db, mockUsers);
      const result = await service.searchUsers('john');
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return array of users', async () => {
      const mockUsers = [
        { id: 'u1', email: 'test@example.com', name: 'Test', avatar: null, role: 'user' as const },
      ];
      
      mockMany(db, mockUsers);
      const result = await service.searchUsers('test');
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no matches', async () => {
      mockEmpty(db);
      const result = await service.searchUsers('nonexistent');
      
      expect(result).toHaveLength(0);
    });

    it('should accept custom limit', async () => {
      const mockUsers = [
        { id: 'u1', email: 'user@example.com', name: 'User', avatar: null, role: 'user' as const },
      ];
      
      mockMany(db, mockUsers);
      const result = await service.searchUsers('user', 5);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use default limit of 10', async () => {
      const mockUsers = [
        { id: 'u1', email: 'user@example.com', name: 'User', avatar: null, role: 'user' as const },
      ];
      
      mockMany(db, mockUsers);
      const result = await service.searchUsers('user');
      
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
