import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminAuditService } from './admin-audit.service';
import { createDrizzleMockForNestJS } from '../../../test/drizzle-mock';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new AdminAuditService(db as any);
  });

  describe('log', () => {
    it('should create audit log entry on admin mutation', async () => {
      db._resultQueue = [[]]; // insert returning

      await service.log({
        adminId: 'admin-1',
        action: 'delete',
        entityType: 'user',
        entityId: 'user-123',
        status: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('should not fail main operation when audit log write fails', async () => {
      // Make insert throw
      db.insert = vi.fn(() => {
        const chainable: any = {
          values: vi.fn(() => {
            throw new Error('DB connection failed');
          }),
        };
        return chainable;
      });

      // Should not throw - error is swallowed
      await expect(
        service.log({
          adminId: 'admin-1',
          action: 'update',
          entityType: 'order',
          entityId: 'order-1',
          status: 'success',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          adminId: 'admin-1',
          action: 'delete',
          entityType: 'user',
          entityId: 'user-1',
          changes: null,
          status: 'success',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          createdAt: new Date('2026-01-01'),
        },
      ];
      // list query, then count query
      db._resultQueue = [mockLogs, [{ total: 1 }]];

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply filters when provided', async () => {
      db._resultQueue = [[], [{ total: 0 }]];

      const result = await service.list({
        action: 'delete',
        entityType: 'user',
        status: 'success',
      });

      expect(result.items).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return stats with totals and breakdowns', async () => {
      // total count, by action, by entity type, failed count
      db._resultQueue = [
        [{ total: 10 }],
        [{ action: 'delete', count: 5 }, { action: 'update', count: 5 }],
        [{ entityType: 'user', count: 10 }],
        [{ total: 2 }],
      ];

      const stats = await service.getStats();

      expect(stats.total).toBe(10);
      expect(stats.failed).toBe(2);
    });
  });
});
