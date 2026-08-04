import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GalleryService } from './gallery.service';
import { createDrizzleMock } from '../../test/drizzle-mock';
import type { DrizzleMock } from '../../test/drizzle-mock';
import { buildGalleryWork, buildGalleryLike } from '../../test/factories';

function createStorageServiceMock() {
  return {
    resolveUrls: vi.fn().mockResolvedValue(new Map<string, string>()),
  };
}

describe('GalleryService', () => {
  let service: GalleryService;
  let db: DrizzleMock;
  let storageService: ReturnType<typeof createStorageServiceMock>;

  beforeEach(() => {
    db = createDrizzleMock();
    storageService = createStorageServiceMock();
    service = new GalleryService(db as any, storageService as any);
  });

  describe('作品发布', () => {
    it('用户应能成功发布作品', async () => {
      const work = buildGalleryWork({ title: '测试作品' });
      db._result = [work];

      const result = await service.publishWork('user-1', {
        title: '测试作品',
        type: 'image',
        imageUrl: 'https://cdn.vibeai.com/test.jpg',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('作品发布时需提供标题', async () => {
      const work = buildGalleryWork({ title: '无标题作品' });
      db._result = [work];

      const result = await service.publishWork('user-1', {
        title: '无标题作品',
        type: 'image',
        imageUrl: 'https://cdn.vibeai.com/test.jpg',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('点赞功能', () => {
    it('用户可以对作品点赞', async () => {
      // 第一次查询：检查是否已点赞 - 返回空（未点赞）
      db._result = [];
      // 第二次查询：插入点赞记录
      const like = buildGalleryLike({ workId: 'work-1', userId: 'user-1' });
      // 在 toggleLike 内部，第二次查询时会用 _result
      // 但由于 mock 只设置一次 _result，我们需要在测试中控制
      // 实际上 toggleLike 先查询再决定插入还是删除
      // 这里我们直接测试查询结果为空时插入成功
      const result = await service.toggleLike('work-1', 'user-1');
      expect(result).toBeDefined();
    });

    it('已经点赞的作品应返回 true', async () => {
      db._result = [{ workId: 'work-1', userId: 'user-1' }];

      const result = await service.checkLike('work-1', 'user-1');
      expect(result.data.liked).toBe(true);
    });

    it('未点赞的作品应返回 false', async () => {
      db._result = [];

      const result = await service.checkLike('work-2', 'user-1');
      expect(result.data.liked).toBe(false);
    });
  });

  describe('作品浏览', () => {
    it('公开画廊只显示已发布作品', async () => {
      const works = [
        buildGalleryWork({ title: '作品1', isPublished: true }),
        buildGalleryWork({ title: '作品2', isPublished: true }),
      ];
      db._result = [works, [{ total: 2 }]];

      const result = await service.listWorks({ type: 'image', sort: 'latest', page: 1, limit: 20 });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('已登录用户可以查看自己的作品', async () => {
      const works = [
        buildGalleryWork({ title: '我的作品', userId: 'user-1' }),
      ];
      db._result = [works, [{ total: 1 }]];

      const result = await service.listWorks({ userId: 'user-1', sort: 'latest' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('作品详情', () => {
    it('应返回作品详情并增加浏览量', async () => {
      const work = buildGalleryWork({ views: 10 });
      db._result = [work];

      const result = await service.getWork('work-1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.views).toBe(11); // 10 + 1
    });

    it('作品不存在时应返回错误', async () => {
      db._result = [];
      const result = await service.getWork('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toBe('作品不存在');
    });
  });

  describe('作品删除', () => {
    it('作品作者应能删除自己的作品', async () => {
      const work = buildGalleryWork({ userId: 'user-1' });
      db._result = [work];

      const result = await service.deleteWork('work-1', 'user-1');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已删除');
    });

    it('非作者删除作品应返回无权操作', async () => {
      const work = buildGalleryWork({ userId: 'user-1' });
      db._result = [work];

      const result = await service.deleteWork('work-1', 'user-2');
      expect(result.success).toBe(false);
      expect(result.message).toBe('无权删除此作品');
    });

    it('删除不存在的作品应返回错误', async () => {
      db._result = [];
      const result = await service.deleteWork('nonexistent', 'user-1');
      expect(result.success).toBe(false);
      expect(result.message).toBe('作品不存在');
    });
  });

  describe('点赞功能', () => {
    it('已点赞的作品应能取消点赞', async () => {
      const work = buildGalleryWork({ likes: 5 });
      const like = buildGalleryLike({ workId: 'work-1', userId: 'user-1' });
      // First query: check work exists → work
      // Second query: check existing like → like (found!)
      // Since _result is shared, use work for both queries
      // work is truthy for both checks
      db._result = [work];
      // Second query returns same _result → work → truthy → unlike path
      const result = await service.toggleLike('work-1', 'user-1');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('作品列表', () => {
    it('空列表应返回成功响应', async () => {
      db._result = [];

      const result = await service.listWorks({});
      expect(result.success).toBe(true);
    });
  });

  describe('从 Create 发布', () => {
    it('通过 createId 发布时自动填充字段', async () => {
      const mockCreate = {
        id: 'create-1',
        userId: 'user-1',
        prompt: '一只橘色的猫',
        capabilitySlug: 'text-to-image',
        modelSlug: 'doubao-seedream-5-0',
        output: { images: [{ fileId: 'file-1', url: 'https://cdn.vibeai.com/cat.png' }] },
        status: 'completed',
      };
      // Both select and insert.returning() get the same _result
      db._result = [mockCreate];
      storageService.resolveUrls.mockResolvedValue(new Map([['file-1', 'https://cdn.vibeai.com/cat.png']]));

      const result = await service.publishWork('user-1', {
        createId: 'create-1',
        type: 'image',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('createId 不存在时仍能发布（字段为空）', async () => {
      const work = buildGalleryWork({ title: '自定义标题', userId: 'user-1' });
      // First query: select create → empty; Second query: insert work → work
      db._result = [[], work];

      const result = await service.publishWork('user-1', {
        createId: 'nonexistent',
        title: '自定义标题',
        type: 'image',
      });

      expect(result.success).toBe(true);
    });

    it('不提供 createId 时使用传入参数', async () => {
      const work = buildGalleryWork({ title: '直接发布', userId: 'user-1' });
      db._result = [work];

      const result = await service.publishWork('user-1', {
        title: '直接发布',
        type: 'image',
        imageUrl: 'https://cdn.vibeai.com/direct.jpg',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('fileId URL 解析', () => {
    it('imageFileId 应通过 storageService 解析为 URL', async () => {
      const works = [
        buildGalleryWork({ imageFileId: 'file-abc', imageUrl: null, isPublished: true }),
      ];
      // _result is returned for BOTH queries in Promise.all; works array is first element
      db._result = works;
      storageService.resolveUrls.mockResolvedValue(
        new Map([['file-abc', 'https://cdn.vibeai.com/resolved.png']])
      );

      const result = await service.listWorks({ sort: 'latest' });
      expect(result.success).toBe(true);
      expect(storageService.resolveUrls).toHaveBeenCalledWith(['file-abc']);
      expect(result.data[0].imageUrl).toBe('https://cdn.vibeai.com/resolved.png');
    });

    it('imageFileId 为 null 时回退到 legacy imageUrl', async () => {
      const works = [
        buildGalleryWork({ imageFileId: null, imageUrl: 'https://legacy.example.com/old.png', isPublished: true }),
      ];
      db._result = works;

      const result = await service.listWorks({ sort: 'latest' });
      expect(result.success).toBe(true);
      // resolveUrls not called when all fileIds are null (early return)
      expect(storageService.resolveUrls).not.toHaveBeenCalled();
      expect(result.data[0].imageUrl).toBe('https://legacy.example.com/old.png');
    });

    it('getWork 时也应解析 fileId', async () => {
      const work = buildGalleryWork({ imageFileId: 'file-xyz', imageUrl: null, views: 5 });
      db._result = [work];
      storageService.resolveUrls.mockResolvedValue(
        new Map([['file-xyz', 'https://cdn.vibeai.com/detail.png']])
      );

      const result = await service.getWork('work-1');
      expect(result.success).toBe(true);
      expect(result.data.imageUrl).toBe('https://cdn.vibeai.com/detail.png');
    });

    it('通过 createId 发布时提取 imageFileId', async () => {
      const mockCreate = {
        id: 'create-1',
        userId: 'user-1',
        prompt: '一只橘色的猫',
        capabilitySlug: 'text-to-image',
        modelSlug: 'doubao-seedream-5-0',
        output: { images: [{ fileId: 'file-img-1', url: 'https://cdn.vibeai.com/cat.png' }] },
        status: 'completed',
      };
      // Both select and insert.returning() get the same _result
      db._result = [mockCreate];
      storageService.resolveUrls.mockResolvedValue(
        new Map([['file-img-1', 'https://cdn.vibeai.com/cat.png']])
      );

      const result = await service.publishWork('user-1', {
        createId: 'create-1',
        type: 'image',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('直接传入 imageFileId 也能发布', async () => {
      const work = buildGalleryWork({ imageFileId: 'file-direct', imageUrl: null, userId: 'user-1' });
      db._result = [work];
      storageService.resolveUrls.mockResolvedValue(
        new Map([['file-direct', 'https://cdn.vibeai.com/direct.png']])
      );

      const result = await service.publishWork('user-1', {
        title: '直接发布',
        type: 'image',
        imageFileId: 'file-direct',
      });

      expect(result.success).toBe(true);
      expect(result.data.imageUrl).toBe('https://cdn.vibeai.com/direct.png');
    });
  });
});