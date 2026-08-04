/**
 * ImageAdapter 单元测试
 *
 * 覆盖范围：
 * - 参数映射：prompt/size/watermark/referenceImages
 * - 响应处理：成功返回 imageUrls、失败抛错
 * - 错误处理：客户端未初始化、helper.success=false
 * - 进度回调
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageAdapter } from './image.adapter';
import type { AdapterModel, ExecutionContext } from './protocol-adapter.interface';

// Mock coze-coding-dev-sdk
const mockGenerate = vi.fn();
const mockGetResponseHelper = vi.fn();

vi.mock('coze-coding-dev-sdk', () => ({
  ImageGenerationClient: vi.fn().mockImplementation(() => ({
    generate: mockGenerate,
    getResponseHelper: mockGetResponseHelper,
  })),
  Config: vi.fn().mockImplementation((opts: Record<string, unknown>) => opts),
}));

describe('ImageAdapter', () => {
  let adapter: ImageAdapter;

  const mockModel: AdapterModel = {
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
    sdkModelId: 'doubao-seedream-5-0-260128',
    modality: 'image',
    constraints: { sizes: ['2K', '4K'], supportsImageToImage: true },
    defaultParams: { size: '2K', watermark: true },
    costCredits: 10,
    sortOrder: 10,
  };

  const mockContext: ExecutionContext = {
    taskId: 'task-img-1',
    userId: 'user-1',
    onProgress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COZE_LOOP_API_TOKEN = 'test-token';
    adapter = new ImageAdapter();

    // Default successful response
    mockGenerate.mockResolvedValue({ id: 'gen-1' });
    mockGetResponseHelper.mockReturnValue({
      success: true,
      imageUrls: ['https://cdn.example.com/img1.png', 'https://cdn.example.com/img2.png'],
      errorMessages: [],
    });
  });

  // ===== 协议属性 =====

  describe('协议属性', () => {
    it('protocolKind 应为 SYNC_REQUEST_RESPONSE', () => {
      expect(adapter.protocolKind).toBe('SYNC_REQUEST_RESPONSE');
    });

    it('modality 应为 image', () => {
      expect(adapter.modality).toBe('image');
    });
  });

  // ===== execute =====

  describe('execute', () => {
    it('基本文生图应返回图片 URL 列表', async () => {
      const result = await adapter.execute(
        { prompt: '一只可爱的猫咪' },
        mockModel,
        mockContext,
      );

      expect(result.output.images).toHaveLength(2);
      expect(result.output.images[0]).toEqual({ url: 'https://cdn.example.com/img1.png' });
      expect(result.output.modelUsed).toBe('doubao-seedream-5-0');
      expect(result.rawResponse).toBeDefined();
    });

    it('应使用 model.defaultParams 中的默认 size', async () => {
      await adapter.execute(
        { prompt: 'test' },
        mockModel,
        mockContext,
      );

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '2K',
          watermark: true,
          model: 'doubao-seedream-5-0-260128',
        }),
      );
    });

    it('input 中的 size 应覆盖 model.defaultParams', async () => {
      await adapter.execute(
        { prompt: 'test', size: '4K' },
        mockModel,
        mockContext,
      );

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: '4K' }),
      );
    });

    it('referenceImages 应映射到 image 参数', async () => {
      await adapter.execute(
        {
          prompt: '风格变换',
          referenceImages: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
        },
        mockModel,
        mockContext,
      );

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          image: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
        }),
      );
    });

    it('单个 referenceImage 应映射为字符串', async () => {
      await adapter.execute(
        {
          prompt: '风格变换',
          referenceImage: 'https://example.com/ref1.png',
        },
        mockModel,
        mockContext,
      );

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'https://example.com/ref1.png',
        }),
      );
    });

    it('成功后应通过 onProgress 推送 100 进度', async () => {
      await adapter.execute(
        { prompt: 'test' },
        mockModel,
        mockContext,
      );

      expect(mockContext.onProgress).toHaveBeenCalledWith(100, expect.stringContaining('2'));
    });

    it('helper.success=false 时抛出错误', async () => {
      mockGetResponseHelper.mockReturnValue({
        success: false,
        imageUrls: [],
        errorMessages: ['内容违规', '请求过于频繁'],
      });

      await expect(
        adapter.execute({ prompt: 'banned content' }, mockModel, mockContext),
      ).rejects.toThrow('内容违规; 请求过于频繁');
    });

    it('helper.success=false 且无错误消息时使用默认错误', async () => {
      mockGetResponseHelper.mockReturnValue({
        success: false,
        imageUrls: [],
        errorMessages: [],
      });

      await expect(
        adapter.execute({ prompt: 'test' }, mockModel, mockContext),
      ).rejects.toThrow('图片生成失败');
    });

    it('无 Token 时进入 Mock 模式返回伪造图片', async () => {
      delete process.env.COZE_LOOP_API_TOKEN;
      delete process.env.COZE_WORKLOAD_API_TOKEN;
      const noTokenAdapter = new ImageAdapter();

      const result = await noTokenAdapter.execute({ prompt: 'a cat' }, mockModel, mockContext);
      expect(result.output.mock).toBe(true);
      expect(result.output.images).toBeDefined();
      expect((result.output.images as Array<{ url: string }>).length).toBeGreaterThan(0);
    });
  });
});
