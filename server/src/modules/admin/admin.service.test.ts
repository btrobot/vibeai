import { describe, it, expect, beforeEach } from 'vitest';
import { AdminService } from './admin.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';

describe('AdminService', () => {
  let service: AdminService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new AdminService(db as any);
  });

  describe('getStats', () => {
    it('should return aggregated platform statistics', async () => {
      // 6 queries all share the same _result
      // Each query expects { value: number } from count/SUM aggregation
      db._result = [{ value: 42 }];

      const stats = await service.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalUsers).toBe(42);
      expect(stats.activeUsers).toBe(42);
      expect(stats.totalProjects).toBe(42);
      expect(stats.totalTasks).toBe(42);
      expect(stats.failedTasks).toBe(42);
      expect(stats.totalStorage).toBe(42);
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
    });
  });
});