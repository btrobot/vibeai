/**
 * StorageService 单元测试
 *
 * 覆盖全部 6 个公开方法：
 * - uploadFile   上传文件 → provider.upload + db insert
 * - listFiles    分页列表 → 条件查询 + count
 * - getFileDetail 详情 → db select + provider.getSignedUrl
 * - deleteFile   删除 → db select + provider.delete + db delete
 * - getSignedUrl 签名URL → db select + provider.getSignedUrl
 * - getStorageStats 统计 → groupBy + sum
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.module';
import { StorageService } from './storage.service';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty, mockMany, mockReturning } from '../../test/drizzle-mock';
import { buildFile, buildUser } from '../../test/factories';

// ===== Test Provider Mock =====
const mockProvider = {
  upload: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  list: vi.fn(),
  getSignedUrl: vi.fn(),
  getStats: vi.fn(),
  getKeyPrefix: vi.fn(),
};

const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

describe('StorageService', () => {
  let service: StorageService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(async () => {
    vi.clearAllMocks();
    db = createDrizzleMockForNestJS();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: DRIZZLE, useValue: db },
        { provide: STORAGE_PROVIDER, useValue: mockProvider },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  // ==================== uploadFile ====================
  describe('uploadFile', () => {
    it('should upload file and insert record', async () => {
      const mockFile = {
        buffer: Buffer.from('test-content'),
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 1024,
      } as Express.Multer.File;

      mockProvider.upload.mockResolvedValue({
        key: 'uploads/user-1/photo.png',
        url: 'https://cdn.vibeai.com/uploads/user-1/photo.png',
        size: 1024,
      });

      const fileRecord = buildFile({
        originalName: 'photo.png',
        mimeType: 'image/png',
        size: 1024,
        category: 'image',
        storageKey: 'uploads/user-1/photo.png',
        url: 'https://cdn.vibeai.com/uploads/user-1/photo.png',
      });

      mockReturning(db, [fileRecord]);

      const result = await service.uploadFile('user-1', mockFile, {
        category: 'image',
        isPublic: false,
      });

      expect(mockProvider.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'photo.png',
          contentType: 'image/png',
          userId: 'user-1',
          category: 'image',
        }),
      );
      expect(result).toBeDefined();
      expect(result.originalName).toBe('photo.png');
      expect(result.category).toBe('image');
    });

    it('should use default category "temp" when not provided', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'doc.txt',
        mimetype: 'text/plain',
        size: 100,
      } as Express.Multer.File;

      mockProvider.upload.mockResolvedValue({
        key: 'uploads/user-1/doc.txt',
        url: 'https://cdn.vibeai.com/uploads/user-1/doc.txt',
        size: 100,
      });

      mockReturning(db, [buildFile({ originalName: 'doc.txt', category: 'temp' })]);

      const result = await service.uploadFile('user-1', mockFile, {});

      expect(mockProvider.upload).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'temp' }),
      );
      expect(result.category).toBe('temp');
    });
  });

  // ==================== listFiles ====================
  describe('listFiles', () => {
    it('should return paginated files list', async () => {
      const file1 = buildFile({ id: 'file-1', originalName: 'img1.png' });
      const file2 = buildFile({ id: 'file-2', originalName: 'img2.png' });

      // Both count and list queries read from the same _result.
      // Set _result to file records so the list query returns them.
      // The count query reads totalResult from _result[0].total, which is undefined,
      // so total falls back to 0. This is a known limitation of the shared _result.
      mockMany(db, [file1, file2]);

      const result = await service.listFiles('user-1', { page: 1, pageSize: 20 });

      // Items should contain the records
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('file-1');
      expect(result.items[1].id).toBe('file-2');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    // Simplified test - just verify the pagination shape
    it('should handle empty list', async () => {
      // Set up mock to return empty for both count and list
      mockEmpty(db);

      const result = await service.listFiles('user-1', { page: 1, pageSize: 20 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(0);
    });
  });

  // ==================== getFileDetail ====================
  describe('getFileDetail', () => {
    it('should return file detail with signed URL', async () => {
      const fileRecord = buildFile({ id: 'file-1' });
      mockSingle(db, fileRecord);
      mockProvider.getSignedUrl.mockResolvedValue('https://signed-url/test.png');

      const result = await service.getFileDetail('user-1', 'file-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('file-1');
      // URL should be the signed URL, not the original
      expect(result!.url).toBe('https://signed-url/test.png');
      expect(mockProvider.getSignedUrl).toHaveBeenCalledWith(fileRecord.storageKey);
    });

    it('should return null when file not found', async () => {
      mockEmpty(db);

      const result = await service.getFileDetail('user-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== deleteFile ====================
  describe('deleteFile', () => {
    it('should delete file from provider and database', async () => {
      const fileRecord = buildFile({ id: 'file-1', storageKey: 'uploads/test.png' });
      mockSingle(db, fileRecord);
      mockProvider.delete.mockResolvedValue(true);

      const result = await service.deleteFile('user-1', 'file-1');

      expect(result).toBe(true);
      expect(mockProvider.delete).toHaveBeenCalledWith(fileRecord.storageKey);
    });

    it('should return false when file not found', async () => {
      mockEmpty(db);

      const result = await service.deleteFile('user-1', 'nonexistent');

      expect(result).toBe(false);
      expect(mockProvider.delete).not.toHaveBeenCalled();
    });
  });

  // ==================== getSignedUrl ====================
  describe('getSignedUrl', () => {
    it('should return signed URL for existing file', async () => {
      const fileRecord = buildFile({ id: 'file-1', storageKey: 'uploads/test.png' });
      mockSingle(db, fileRecord);
      mockProvider.getSignedUrl.mockResolvedValue('https://signed-url/test.png');

      const result = await service.getSignedUrl('user-1', 'file-1');

      expect(result).toBe('https://signed-url/test.png');
    });

    it('should return null when file not found', async () => {
      mockEmpty(db);

      const result = await service.getSignedUrl('user-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== getStorageStats ====================
  describe('getStorageStats', () => {
    it('should return grouped storage statistics', async () => {
      // Set up the mock for the groupBy query
      // The service does: db.select({...}).from(files).where(...).groupBy(files.category)
      // The chain: select → from → where → groupBy → await

      // In the mock, `groupBy` is a terminal method that returns Promise.resolve(terminalResult)
      // So I need to set terminalResult to the stats data

      // Actually, looking at the mock, `groupBy` is not defined as a terminal method.
      // Let me check... In the drizzle-mock.ts, I see the chainable has:
      // - Chain methods: select, from, where, orderBy, limit, offset, groupBy, values, insert, delete
      // - Terminal methods: limit, offset, returning, groupBy, execute, all

      // Actually, in the chainable mock, ALL methods are chain methods (return chainable).
      // The terminal methods are: limit, offset, returning, groupBy, execute, all
      // which return `Promise.resolve(terminalResult)`.

      // So for the groupBy query, `groupBy` returns `Promise.resolve(terminalResult)`.
      // I need to set terminalResult to the stats data.

      // But wait - the groupBy query doesn't use `groupBy` as a terminal method
      // in the same way. Let me look at the actual query:
      // ```
      // const result = await this.db
      //   .select({...})
      //   .from(files)
      //   .where(eq(files.userId, userId))
      //   .groupBy(files.category);
      // ```
      // The `await` is on the result of `groupBy`, which returns `Promise.resolve(terminalResult)`.

      // In the mock, `groupBy` returns `Promise.resolve(terminalResult)`.
      // So I set `mockSingle(db, [{category: 'image', count: 3, totalSize: 307200}])`.

      // But wait, the count query in listFiles also uses `await db.select().from().where()`
      // without a terminal method (no limit/offset/groupBy). In that case, the `await` triggers
      // the `then` proxy on the chainable, which returns `terminalResult`.

      // Hmm, let me think about this more carefully.
      // The chainable object has `then: undefined` and the proxy intercepts the `then` property.
      // When `await chainable` is called, it looks for `chainable.then`.
      // The proxy intercepts `get(target, 'then')` and returns `(resolve) => resolve(terminalResult)`.
      // So `await chainable` resolves to `terminalResult`.

      // When `chainable.groupBy(x)` is called, it returns `Promise.resolve(terminalResult)`.
      // So `await chainable.groupBy(x)` also resolves to `terminalResult`.

      // Both use `terminalResult`, so I can set it with `mockSingle`.

      mockMany(db, [
        { category: 'image', count: 3, totalSize: 307200 },
        { category: 'video', count: 1, totalSize: 104857600 },
      ]);

      const result = await service.getStorageStats('user-1');

      expect(result.totalFiles).toBe(4);
      expect(result.totalSize).toBe(104857600 + 307200);
      expect(result.byCategory['image']).toBeDefined();
      expect(result.byCategory['image'].count).toBe(3);
      expect(result.byCategory['video'].count).toBe(1);
    });

    it('should return empty stats when no files', async () => {
      mockEmpty(db);

      const result = await service.getStorageStats('user-1');

      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.byCategory).toEqual({});
    });
  });
});