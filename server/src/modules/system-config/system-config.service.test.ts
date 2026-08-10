import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemConfigService } from './system-config.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';
import { EmailService } from '../../common/email.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let db: DrizzleMock;
  let emailService: { isEmailEnabled: ReturnType<typeof vi.fn>; sendEmail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = createDrizzleMock();
    emailService = {
      isEmailEnabled: vi.fn(() => false),
      sendEmail: vi.fn(),
    };
    service = new SystemConfigService(db as any, emailService as unknown as EmailService);
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

  describe('exportAll', () => {
    it('should return all settings for export', async () => {
      db._resultQueue = [[{ key: 'a' }, { key: 'b' }]];

      const result = await service.exportAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('importAll', () => {
    it('should import settings with created/updated counts', async () => {
      // Each await consumes from the queue:
      // item 1: select (not found) -> insert
      // item 2: select (found) -> update
      db._resultQueue = [
        [],                    // select for item 1 (not found)
        [],                    // insert for item 1 (awaited)
        [{ key: 'key-2' }],    // select for item 2 (found)
        [],                    // update for item 2 (awaited)
      ];

      const result = await service.importAll({
        settings: [
          { key: 'key-1', value: { a: 1 }, category: 'general' as any },
          { key: 'key-2', value: { b: 2 }, category: 'general' as any },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(1);
      expect(result.data.updated).toBe(1);
      expect(result.data.total).toBe(2);
    });
  });

  describe('testEmail', () => {
    it('should return failure when email not configured', async () => {
      emailService.isEmailEnabled.mockReturnValue(false);

      const result = await service.testEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toContain('未配置');
    });

    it('should send test email when configured', async () => {
      emailService.isEmailEnabled.mockReturnValue(true);
      emailService.sendEmail.mockResolvedValue(true);

      const result = await service.testEmail('test@example.com');

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('testStorage', () => {
    it('should return success for local storage', async () => {
      delete process.env.STORAGE_PROVIDER;

      const result = await service.testStorage();

      expect(result.success).toBe(true);
      expect(result.details.provider).toBe('local');
    });

    it('should return failure for S3 without bucket config', async () => {
      process.env.STORAGE_PROVIDER = 's3';
      delete process.env.S3_BUCKET_NAME;
      delete process.env.COZE_BUCKET_NAME;

      const result = await service.testStorage();

      expect(result.success).toBe(false);
      expect(result.message).toContain('未完整配置');

      // Cleanup
      delete process.env.STORAGE_PROVIDER;
    });
  });
});
