import { describe, it, expect, beforeEach } from 'vitest';
import { AnnouncementService } from './announcement.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new AnnouncementService(db as any);
  });

  describe('create', () => {
    it('should create an announcement successfully', async () => {
      db._resultQueue = [[{ id: 'ann-1', title: '系统维护通知', type: 'maintenance' }]];

      const result = await service.create({
        title: '系统维护通知',
        content: '系统将于今晚维护',
        type: 'maintenance' as any,
      }, 'user-1');
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('系统维护通知');
    });

    it('should handle scheduled and expiry dates', async () => {
      db._resultQueue = [[{ id: 'ann-2', title: '限时活动' }]];

      const result = await service.create({
        title: '限时活动',
        content: '活动内容',
        type: 'info' as any,
        scheduledAt: '2026-08-15T10:00:00Z',
        expiresAt: '2026-08-20T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when announcement does not exist', async () => {
      db._resultQueue = [[]];

      await expect(service.update('non-existent', { title: 'Updated' }))
        .rejects.toThrow('公告不存在');
    });

    it('should update announcement successfully', async () => {
      db._resultQueue = [
        [{ id: 'ann-1', title: 'Old' }],  // select existing
        [{ id: 'ann-1', title: 'New Title' }],  // update returning
      ];

      const result = await service.update('ann-1', { title: 'New Title' });
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New Title');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when announcement does not exist', async () => {
      db._resultQueue = [[]];

      await expect(service.delete('non-existent'))
        .rejects.toThrow('公告不存在');
    });

    it('should delete announcement successfully', async () => {
      db._resultQueue = [[{ id: 'ann-1' }]];

      const result = await service.delete('ann-1');
      expect(result.success).toBe(true);
    });
  });

  describe('listActive', () => {
    it('should return active and non-expired announcements', async () => {
      db._resultQueue = [[
        { id: 'ann-1', title: 'Active 1', isPinned: true },
        { id: 'ann-2', title: 'Active 2', isPinned: false },
      ]];

      const result = await service.listActive();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no active announcements', async () => {
      db._resultQueue = [[]];

      const result = await service.listActive();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException when not found', async () => {
      db._resultQueue = [[]];

      await expect(service.getById('non-existent'))
        .rejects.toThrow('公告不存在');
    });

    it('should return announcement by id', async () => {
      db._resultQueue = [[{ id: 'ann-1', title: 'Test' }]];

      const result = await service.getById('ann-1');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('ann-1');
    });
  });

  describe('listForAdmin', () => {
    it('should return paginated list with all announcements', async () => {
      db._resultQueue = [
        [{ id: 'ann-1' }, { id: 'ann-2' }],  // items query
        [{ total: 2 }],  // count query
      ];

      const result = await service.listForAdmin({ page: '1', limit: '10' });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by type when provided', async () => {
      db._resultQueue = [
        [{ id: 'ann-1', type: 'warning' }],
        [{ total: 1 }],
      ];

      const result = await service.listForAdmin({ type: 'warning' as any });
      expect(result.success).toBe(true);
    });
  });
});
