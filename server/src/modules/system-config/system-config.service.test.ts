import { describe, it, expect, beforeEach } from 'vitest';
import { SystemConfigService } from './system-config.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let db: DrizzleMock;

  beforeEach(() => {
    db = createDrizzleMock();
    service = new SystemConfigService(db as any);
  });

  describe('upsert', () => {
    it('should create new setting when key does not exist', async () => {
      db._resultQueue = [
        [],  // select existing (not found)
        [{ key: 'homepage.carousel', value: { items: [] } }],  // insert returning
      ];

      const result = await service.upsert({
        key: 'homepage.carousel',
        value: { items: [] },
        category: 'homepage' as any,
      });
      expect(result.success).toBe(true);
    });

    it('should update existing setting when key exists', async () => {
      db._resultQueue = [
        [{ key: 'homepage.carousel', value: { old: true } }],  // select existing
        [{ key: 'homepage.carousel', value: { new: true } }],  // update returning
      ];

      const result = await service.upsert({
        key: 'homepage.carousel',
        value: { new: true },
        category: 'homepage' as any,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('listForAdmin', () => {
    it('should return all settings', async () => {
      db._resultQueue = [[{ key: 'seo.title' }, { key: 'homepage.carousel' }]];

      const result = await service.listForAdmin({});
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter by category when provided', async () => {
      db._resultQueue = [[{ key: 'seo.title', category: 'seo' }]];

      const result = await service.listForAdmin({ category: 'seo' as any });
      expect(result.success).toBe(true);
    });
  });

  describe('listPublic', () => {
    it('should return only public settings', async () => {
      db._resultQueue = [[{ key: 'homepage.carousel', isPublic: true }]];

      const result = await service.listPublic('homepage');
      expect(result.success).toBe(true);
    });
  });

  describe('getByKey', () => {
    it('should throw NotFoundException when key does not exist', async () => {
      db._resultQueue = [[]];

      await expect(service.getByKey('non-existent'))
        .rejects.toThrow('配置 non-existent 不存在');
    });

    it('should return setting by key', async () => {
      db._resultQueue = [[{ key: 'seo.title', value: { title: 'VibeAI' } }]];

      const result = await service.getByKey('seo.title');
      expect(result.success).toBe(true);
      expect(result.data.key).toBe('seo.title');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when key does not exist', async () => {
      db._resultQueue = [[]];

      await expect(service.delete('non-existent'))
        .rejects.toThrow('配置 non-existent 不存在');
    });

    it('should delete setting successfully', async () => {
      db._resultQueue = [[{ key: 'seo.title' }]];

      const result = await service.delete('seo.title');
      expect(result.success).toBe(true);
    });
  });
});
