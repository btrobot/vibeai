/**
 * VideoAdapter 单元测试
 *
 * 覆盖范围：
 * - content 构建：文生视频（仅 text）、图生视频（首帧/尾帧）、多模态参考
 * - 参数映射：duration/ratio/resolution/watermark/generateAudio/seed
 * - 响应处理：videoUrl/lastFrameUrl/providerTaskId
 * - 错误处理：客户端未初始化、无 videoUrl
 * - 进度回调
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoAdapter } from './video.adapter';
import type { AdapterModel, ExecutionContext } from './protocol-adapter.interface';

// Mock coze-coding-dev-sdk
const mockVideoGeneration = vi.fn();

vi.mock('coze-coding-dev-sdk', () => ({
  VideoGenerationClient: vi.fn().mockImplementation(() => ({
    videoGeneration: mockVideoGeneration,
  })),
  Config: vi.fn().mockImplementation((opts: Record<string, unknown>) => opts),
}));

describe('VideoAdapter', () => {
  let adapter: VideoAdapter;

  const mockModel: AdapterModel = {
    slug: 'doubao-seedance-1-5-pro',
    name: 'Doubao Seedance 1.5 Pro',
    sdkModelId: 'doubao-seedance-1-5-pro-251215',
    modality: 'video',
    outputType: 'video',
    sdkClient: 'coze',
    constraints: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1'] },
    defaultParams: { duration: 5, ratio: '16:9', resolution: '720p', watermark: true, generateAudio: true, returnLastFrame: true, maxWaitTime: 900 },
    costCredits: 30,
    sortOrder: 20,
  };

  const mockModelMultimodal: AdapterModel = {
    ...mockModel,
    slug: 'doubao-seedance-2-0',
    sdkModelId: 'doubao-seedance-2-0-260128',
    constraints: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1'], supportsMultimodalReference: true },
  };

  const mockContext: ExecutionContext = {
    taskId: 'task-video-1',
    userId: 'user-1',
    onProgress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COZE_LOOP_API_TOKEN = 'test-token';
    adapter = new VideoAdapter();

    // Default successful response
    mockVideoGeneration.mockResolvedValue({
      videoUrl: 'https://cdn.example.com/video.mp4',
      lastFrameUrl: 'https://cdn.example.com/lastframe.png',
      response: {
        id: 'provider-task-123',
        seed: 42,
        duration: 5,
        resolution: '720p',
        error_message: '',
      },
    });
  });

  // ===== 协议属性 =====

  describe('协议属性', () => {
    it('protocolKind 应为 ASYNC_TASK', () => {
      expect(adapter.protocolKind).toBe('ASYNC_TASK');
    });

    it('modality 应为 video', () => {
      expect(adapter.modality).toBe('video');
    });
  });

  // ===== execute: 文生视频 =====

  describe('execute - 文生视频', () => {
    it('纯文本输入应正确生成视频', async () => {
      const result = await adapter.execute(
        { prompt: '夕阳下的海边' },
        mockModel,
        mockContext,
      );

      expect(result.output.video).toEqual({ url: 'https://cdn.example.com/video.mp4' });
      expect(result.output.lastFrameUrl).toBe('https://cdn.example.com/lastframe.png');
      expect(result.output.modelUsed).toBe('doubao-seedance-1-5-pro');
      expect(result.output.seed).toBe(42);
      expect(result.output.duration).toBe(5);
      expect(result.output.resolution).toBe('720p');
      expect(result.providerTaskId).toBe('provider-task-123');
    });

    it('应使用 model.defaultParams 中的默认参数', async () => {
      await adapter.execute(
        { prompt: 'test' },
        mockModel,
        mockContext,
      );

      expect(mockVideoGeneration).toHaveBeenCalledWith(
        expect.any(Array), // content array
        expect.objectContaining({
          model: 'doubao-seedance-1-5-pro-251215',
          duration: 5,
          ratio: '16:9',
          resolution: '720p',
          watermark: true,
          generateAudio: true,
          returnLastFrame: true,
          maxWaitTime: 900,
        }),
      );
    });

    it('input 参数应覆盖 model.defaultParams', async () => {
      await adapter.execute(
        {
          prompt: 'test',
          duration: 10,
          ratio: '9:16',
          resolution: '1080p',
          watermark: false,
          generateAudio: false,
        },
        mockModel,
        mockContext,
      );

      expect(mockVideoGeneration).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          duration: 10,
          ratio: '9:16',
          resolution: '1080p',
          watermark: false,
          generateAudio: false,
        }),
      );
    });

    it('seed 和 cameraFixed 应正确传递', async () => {
      await adapter.execute(
        {
          prompt: 'test',
          seed: 12345,
          cameraFixed: true,
        },
        mockModel,
        mockContext,
      );

      expect(mockVideoGeneration).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          seed: 12345,
          camerafixed: true,
        }),
      );
    });

    it('提交时和完成时都应推送进度', async () => {
      await adapter.execute(
        { prompt: 'test' },
        mockModel,
        mockContext,
      );

      expect(mockContext.onProgress).toHaveBeenCalledWith(10, '提交生成请求');
      expect(mockContext.onProgress).toHaveBeenCalledWith(100, '视频生成完成');
    });
  });

  // ===== execute: 图生视频 =====

  describe('execute - 图生视频', () => {
    it('首帧图片应正确构建 content（first_frame role）', async () => {
      await adapter.execute(
        {
          prompt: '让图片动起来',
          firstFrame: 'https://example.com/first.png',
        },
        mockModel,
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      expect(contentArg).toHaveLength(2); // image_url + text
      expect(contentArg[0].type).toBe('image_url');
      expect(contentArg[0].role).toBe('first_frame');
      expect(contentArg[0].image_url.url).toBe('https://example.com/first.png');
      expect(contentArg[1].type).toBe('text');
    });

    it('首帧+尾帧应构建 3 个 content 项', async () => {
      await adapter.execute(
        {
          prompt: '首尾帧动画',
          firstFrame: 'https://example.com/first.png',
          lastFrame: 'https://example.com/last.png',
        },
        mockModel,
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      expect(contentArg).toHaveLength(3);
      expect(contentArg[0].role).toBe('first_frame');
      expect(contentArg[1].role).toBe('last_frame');
      expect(contentArg[2].type).toBe('text');
    });
  });

  // ===== execute: 多模态参考 =====

  describe('execute - 多模态参考 (Seedance 2.0)', () => {
    it('参考图片应构建 reference_image role', async () => {
      await adapter.execute(
        {
          prompt: '参考风格生成',
          referenceImages: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
        },
        mockModelMultimodal,
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      expect(contentArg[0].type).toBe('image_url');
      expect(contentArg[0].role).toBe('reference_image');
      expect(contentArg[1].role).toBe('reference_image');
      // Last item is text
      expect(contentArg[contentArg.length - 1].type).toBe('text');
    });

    it('参考视频应构建 reference_video role', async () => {
      await adapter.execute(
        {
          prompt: '参考视频风格',
          referenceVideos: ['https://example.com/ref.mp4'],
        },
        mockModelMultimodal,
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      expect(contentArg[0].type).toBe('video_url');
      expect(contentArg[0].role).toBe('reference_video');
    });

    it('参考音频应构建 reference_audio role', async () => {
      await adapter.execute(
        {
          prompt: '参考音频生成',
          referenceAudios: ['https://example.com/ref.mp3'],
        },
        mockModelMultimodal,
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      expect(contentArg[0].type).toBe('audio_url');
      expect(contentArg[0].role).toBe('reference_audio');
    });

    it('模型不支持多模态参考时应回退到文生视频', async () => {
      await adapter.execute(
        {
          prompt: 'test',
          referenceImages: ['https://example.com/ref.png'],
        },
        mockModel, // does NOT have supportsMultimodalReference
        mockContext,
      );

      const contentArg = mockVideoGeneration.mock.calls[0][0];
      // Should be text-only (fallback to text-to-video)
      expect(contentArg).toHaveLength(1);
      expect(contentArg[0].type).toBe('text');
    });
  });

  // ===== 错误处理 =====

  describe('错误处理', () => {
    it('无 videoUrl 时抛出错误', async () => {
      mockVideoGeneration.mockResolvedValue({
        videoUrl: null,
        lastFrameUrl: null,
        response: {
          id: 'task-fail',
          error_message: '生成超时',
        },
      });

      await expect(
        adapter.execute({ prompt: 'test' }, mockModel, mockContext),
      ).rejects.toThrow('生成超时');
    });

    it('无 videoUrl 且无 error_message 时使用默认错误', async () => {
      mockVideoGeneration.mockResolvedValue({
        videoUrl: null,
        lastFrameUrl: null,
        response: {
          id: 'task-fail',
          error_message: '',
        },
      });

      await expect(
        adapter.execute({ prompt: 'test' }, mockModel, mockContext),
      ).rejects.toThrow('视频生成失败');
    });

    it('无 Token 时渠道配置不完整直接抛错（不再 Mock）', async () => {
      delete process.env.COZE_LOOP_API_TOKEN;
      delete process.env.COZE_WORKLOAD_API_TOKEN;
      const noTokenAdapter = new VideoAdapter();

      await expect(
        noTokenAdapter.execute({ prompt: 'a sunset' }, mockModel, mockContext),
      ).rejects.toThrow(/视频生成渠道配置不完整：未设置 COZE_LOOP_API_TOKEN/);
    });
  });
});
