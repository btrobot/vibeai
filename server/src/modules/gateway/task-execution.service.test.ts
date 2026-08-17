/**
 * TaskExecutionService 单元测试
 *
 * 覆盖范围：
 * - 完整执行流程：queued → submitting → completing → completed
 * - 失败流程：submitting → failed + 信用退款
 * - 结果转存：图片/视频/尾帧 URL → downloadAndStore
 * - WebSocket 推送：status/progress/completed/failed
 * - 信用生命周期：settleCredits（成功）/ refundCredits（失败）
 * - 多 Provider 路由 + Fallback
 * - ProviderAttempt 审计记录
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutionService } from './task-execution.service';
import { createDrizzleMockForNestJS } from '../../test/drizzle-mock';
import type { AdapterModel } from './adapters/protocol-adapter.interface';

// ===== Mock Services =====
const mockWsService = {
  sendToUser: vi.fn(),
};

const mockStorageService = {
  downloadAndStore: vi.fn(),
};

const mockBillingService = {
  settleCredits: vi.fn().mockResolvedValue(undefined),
  refundCredits: vi.fn().mockResolvedValue(undefined),
};

const mockAdapter = {
  execute: vi.fn(),
  protocolKind: 'SYNC_REQUEST_RESPONSE' as const,
  modality: 'image' as const,
  sdkClient: 'image',
};

const mockAdapterRegistry = {
  getAdapter: vi.fn().mockReturnValue(mockAdapter),
};

const mockCreateService = {
  syncCreateStatus: vi.fn().mockResolvedValue(undefined),
};

const mockProviderService = {
  getAvailableProviders: vi.fn(),
};

describe('TaskExecutionService', () => {
  let service: TaskExecutionService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  const mockModel: AdapterModel = {
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
    sdkModelId: 'doubao-seedream-5-0-260128',
    modality: 'image',
    outputType: 'image',
    platformName: 'doubao',
    sdkClient: 'image',
    constraints: {},
    defaultParams: {},
    costCredits: 10,
    sortOrder: 10,
  };

  const defaultProvider = {
    platformName: 'doubao',
    sdkModelId: 'doubao-seedream-5-0-260128',
    sdkClient: 'image',
    priority: 0,
    costPerCall: null,
    config: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDrizzleMockForNestJS();
    mockProviderService.getAvailableProviders.mockResolvedValue([defaultProvider]);

    service = new TaskExecutionService(
      db as any,
      mockWsService as any,
      mockStorageService as any,
      mockBillingService as any,
      mockCreateService as any,
      mockAdapterRegistry as any,
      mockProviderService as any,
    );
  });

  // ===== 成功流程 =====

  describe('executeTask - 成功流程', () => {
    it('图片生成：queued → submitting → completing → completed', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: {
          images: [{ url: 'https://cdn.example.com/generated.png' }],
          modelUsed: 'doubao-seedream-5-0',
        },
      });

      mockStorageService.downloadAndStore.mockResolvedValue({
        fileId: 'file-1',
        url: 'https://storage.vibeai.com/task-1-img-0.png',
      });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'cat' }, mockModel);

      // DB updates: submitting → completing → completed (3 updates)
      expect(db.update).toHaveBeenCalledTimes(3);

      // WebSocket: submitting status, completing status, completed
      expect(mockWsService.sendToUser).toHaveBeenCalledTimes(3);
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:status',
        payload: { taskId: 'task-1', status: 'submitting' },
      });
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:status',
        payload: { taskId: 'task-1', status: 'completing' },
      });
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:completed',
        payload: expect.objectContaining({ taskId: 'task-1' }),
      });

      // Credit settlement
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
      expect(mockBillingService.refundCredits).not.toHaveBeenCalled();
    });

    it('视频生成：应转存视频 URL 和尾帧 URL', async () => {
      mockProviderService.getAvailableProviders.mockResolvedValue([
        { ...defaultProvider, sdkClient: 'video', sdkModelId: 'doubao-seedance-1-5-pro-251215' },
      ]);

      mockAdapter.execute.mockResolvedValue({
        output: {
          video: { url: 'https://cdn.example.com/video.mp4' },
          lastFrameUrl: 'https://cdn.example.com/lastframe.png',
          modelUsed: 'doubao-seedance-1-5-pro',
        },
        providerTaskId: 'provider-task-123',
      });

      mockStorageService.downloadAndStore
        .mockResolvedValueOnce({ fileId: 'file-video', url: 'https://storage.vibeai.com/task-1.mp4' })
        .mockResolvedValueOnce({ fileId: 'file-frame', url: 'https://storage.vibeai.com/task-1-lastframe.png' });

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'sunset' }, mockModel);

      // Should call downloadAndStore twice: video + lastFrame
      expect(mockStorageService.downloadAndStore).toHaveBeenCalledTimes(2);
      expect(mockStorageService.downloadAndStore).toHaveBeenCalledWith(
        'user-1',
        'https://cdn.example.com/video.mp4',
        'task-task-1.mp4',
        'video/mp4',
        'generated',
      );
      expect(mockStorageService.downloadAndStore).toHaveBeenCalledWith(
        'user-1',
        'https://cdn.example.com/lastframe.png',
        'task-task-1-lastframe.png',
        'image/png',
        'generated',
      );
    });

    it('多张图片应全部转存', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: {
          images: [
            { url: 'https://cdn.example.com/img1.png' },
            { url: 'https://cdn.example.com/img2.png' },
            { url: 'https://cdn.example.com/img3.png' },
          ],
          modelUsed: 'doubao-seedream-5-0',
        },
      });

      mockStorageService.downloadAndStore
        .mockResolvedValue({ fileId: 'file-1', url: 'https://storage.vibeai.com/img1.png' })
        .mockResolvedValue({ fileId: 'file-2', url: 'https://storage.vibeai.com/img2.png' })
        .mockResolvedValue({ fileId: 'file-3', url: 'https://storage.vibeai.com/img3.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'cats' }, mockModel);

      expect(mockStorageService.downloadAndStore).toHaveBeenCalledTimes(3);
    });

    it('LLM 文本输出不触发转存（无 images/video/lastFrameUrl）', async () => {
      mockProviderService.getAvailableProviders.mockResolvedValue([
        { ...defaultProvider, sdkClient: 'llm' },
      ]);

      mockAdapter.execute.mockResolvedValue({
        output: {
          content: '这是 AI 生成的文本',
          modelUsed: 'doubao-seed-2-0-pro',
        },
      });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: '写文章' }, mockModel);

      expect(mockStorageService.downloadAndStore).not.toHaveBeenCalled();
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
    });

    it('providerTaskId 应被保存到 DB', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: { video: { url: 'https://cdn.example.com/video.mp4' } },
        providerTaskId: 'provider-task-xyz',
      });

      mockStorageService.downloadAndStore.mockResolvedValue({
        fileId: 'file-1',
        url: 'https://storage.vibeai.com/video.mp4',
      });

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'test' }, mockModel);

      expect(mockAdapter.execute).toHaveBeenCalled();
    });

    it('适配器执行过程中 onProgress 应推送 WebSocket 进度', async () => {
      mockAdapter.execute.mockImplementation(async (_input, _model, context) => {
        context.onProgress?.(50, '正在生成...');
        return { output: { content: 'done' } };
      });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      // Should have sent progress via WebSocket
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:progress',
        payload: { taskId: 'task-1', progress: 50, message: '正在生成...' },
      });
    });
  });

  // ===== 失败流程 =====

  describe('executeTask - 失败流程', () => {
    it('适配器抛出异常时应标记 failed 并退款', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('模型服务不可用'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // DB: submitting + failed = 2 updates
      expect(db.update).toHaveBeenCalledTimes(2);

      // WebSocket: submitting status + task:failed
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:status',
        payload: { taskId: 'task-1', status: 'submitting' },
      });
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '所有渠道均失败: 模型服务不可用' },
      });

      // Credit refund
      expect(mockBillingService.refundCredits).toHaveBeenCalledWith(
        'user-1', 'task-1', 10, '任务失败退款',
      );
      expect(mockBillingService.settleCredits).not.toHaveBeenCalled();
    });

    it('退款失败时不应影响任务失败状态', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('生成失败'));
      mockBillingService.refundCredits.mockRejectedValue(new Error('退款服务不可用'));

      // Should not throw
      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Task should still be marked as failed
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '所有渠道均失败: 生成失败' },
      });
    });
  });

  // ===== 结果转存容错 =====

  describe('transferResult - 容错', () => {
    it('图片转存失败时应保留原始 URL 不中断流程', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: {
          images: [{ url: 'https://cdn.example.com/img1.png' }],
          modelUsed: 'doubao-seedream-5-0',
        },
      });

      mockStorageService.downloadAndStore.mockRejectedValue(new Error('存储服务不可用'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Task should still complete successfully
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:completed',
        payload: expect.objectContaining({ taskId: 'task-1' }),
      });
    });

    it('视频转存失败时应保留原始 URL', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: {
          video: { url: 'https://cdn.example.com/video.mp4' },
          modelUsed: 'doubao-seedance-1-5-pro',
        },
        providerTaskId: 'pt-1',
      });

      mockStorageService.downloadAndStore.mockRejectedValue(new Error('下载超时'));

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'test' }, mockModel);

      // Should still complete
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
    });

    it('部分图片转存失败不影响其他图片', async () => {
      mockAdapter.execute.mockResolvedValue({
        output: {
          images: [
            { url: 'https://cdn.example.com/img1.png' },
            { url: 'https://cdn.example.com/img2.png' },
          ],
          modelUsed: 'doubao-seedream-5-0',
        },
      });

      mockStorageService.downloadAndStore
        .mockResolvedValueOnce({ fileId: 'file-1', url: 'https://storage.vibeai.com/img1.png' })
        .mockRejectedValueOnce(new Error('第二张下载失败'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Both images should have been attempted
      expect(mockStorageService.downloadAndStore).toHaveBeenCalledTimes(2);
      // Task should complete
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
    });
  });

  // ===== 适配器分发 =====

  describe('适配器分发', () => {
    it('应根据 provider.sdkClient 获取适配器', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'ok' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('image');
    });

    it('video sdkClient 应获取 video 适配器', async () => {
      mockProviderService.getAvailableProviders.mockResolvedValue([
        { ...defaultProvider, sdkClient: 'video', sdkModelId: 'doubao-seedance-1-5-pro-251215' },
      ]);
      const videoModel: AdapterModel = { ...mockModel, modality: 'video', sdkClient: 'video' };
      mockAdapter.execute.mockResolvedValue({ output: { video: { url: 'https://x.com/v.mp4' } } });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/v.mp4' });

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'hi' }, videoModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('video');
    });

    it('llm sdkClient 应获取 llm 适配器', async () => {
      mockProviderService.getAvailableProviders.mockResolvedValue([
        { ...defaultProvider, sdkClient: 'llm' },
      ]);
      const llmModel: AdapterModel = { ...mockModel, modality: 'llm', sdkClient: 'llm' };
      mockAdapter.execute.mockResolvedValue({ output: { content: 'hello' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, llmModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('llm');
    });
  });

  // ===== 多 Provider Fallback =====

  describe('多 Provider 路由 + Fallback', () => {
    it('第一个 provider 成功时不尝试第二个', async () => {
      const provider1 = { platformName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc', sdkClient: 'replicate', priority: 1, costPerCall: 0.05, config: {} };
      const provider2 = { platformName: 'coze', sdkModelId: 'doubao-seedream-5-0-260128', sdkClient: 'image', priority: 2, costPerCall: null, config: {} };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider1, provider2]);

      mockAdapter.execute.mockResolvedValue({
        output: { images: [{ url: 'https://cdn.example.com/img.png' }] },
      });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/img.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Should only call getAdapter once (first provider succeeded)
      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledTimes(1);
      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('replicate');
    });

    it('第一个 provider 失败时应 fallback 到第二个', async () => {
      const provider1 = { platformName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc', sdkClient: 'replicate', priority: 1, costPerCall: 0.05, config: {} };
      const provider2 = { platformName: 'coze', sdkModelId: 'doubao-seedream-5-0-260128', sdkClient: 'image', priority: 2, costPerCall: null, config: {} };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider1, provider2]);

      // First call fails, second succeeds
      mockAdapter.execute
        .mockRejectedValueOnce(new Error('Replicate 不可用'))
        .mockResolvedValueOnce({
          output: { images: [{ url: 'https://cdn.example.com/img.png' }] },
        });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/img.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Should call getAdapter twice (both providers tried)
      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledTimes(2);
      expect(mockAdapterRegistry.getAdapter).toHaveBeenNthCalledWith(1, 'replicate');
      expect(mockAdapterRegistry.getAdapter).toHaveBeenNthCalledWith(2, 'image');

      // Task should complete successfully
      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
    });

    it('所有 provider 都失败时应抛出"所有渠道均失败"', async () => {
      const provider1 = { platformName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc', sdkClient: 'replicate', priority: 1, costPerCall: 0.05, config: {} };
      const provider2 = { platformName: 'coze', sdkModelId: 'doubao-seedream-5-0-260128', sdkClient: 'image', priority: 2, costPerCall: null, config: {} };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider1, provider2]);

      mockAdapter.execute
        .mockRejectedValueOnce(new Error('Replicate 不可用'))
        .mockRejectedValueOnce(new Error('Coze 也不可用'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Should try both providers
      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledTimes(2);

      // Task should be failed
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '所有渠道均失败: Coze 也不可用' },
      });

      // Credits should be refunded
      expect(mockBillingService.refundCredits).toHaveBeenCalledWith('user-1', 'task-1', 10, '任务失败退款');
    });

    it('模型 defaultParams 覆盖渠道 config（二级 key：模型 > 渠道）', async () => {
      const provider = {
        platformName: 'pptoken', sdkModelId: 'gpt-image-2', sdkClient: 'openai',
        priority: 1, costPerCall: 0.05,
        config: { apiKey: 'channel-key', baseUrl: 'https://channel.example/v1' },
      };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider]);
      const modelWithKey: AdapterModel = {
        ...mockModel,
        sdkClient: 'openai',
        defaultParams: { apiKey: 'model-key', baseUrl: 'https://model.example/v1' },
      };

      mockAdapter.execute.mockResolvedValue({ output: { images: [{ url: 'https://cdn.example.com/a.png' }] } });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/a.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, modelWithKey);

      const passedModel = mockAdapter.execute.mock.calls[0][1] as AdapterModel;
      expect(passedModel.defaultParams.apiKey).toBe('model-key');
      expect(passedModel.defaultParams.baseUrl).toBe('https://model.example/v1');
    });

    it('渠道 config 提供默认 key（模型未指定时）', async () => {
      const provider = {
        platformName: 'pptoken', sdkModelId: 'gpt-image-2', sdkClient: 'openai',
        priority: 1, costPerCall: 0.05,
        config: { apiKey: 'channel-key', baseUrl: 'https://channel.example/v1' },
      };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider]);

      mockAdapter.execute.mockResolvedValue({ output: { images: [{ url: 'https://cdn.example.com/a.png' }] } });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/a.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      const passedModel = mockAdapter.execute.mock.calls[0][1] as AdapterModel;
      expect(passedModel.defaultParams.apiKey).toBe('channel-key');
    });

    it('provider 成功时应传递 provider 的 sdkModelId 给适配器', async () => {
      const provider = { platformName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc123', sdkClient: 'replicate', priority: 1, costPerCall: 0.05, config: { width: 1024 } };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider]);

      mockAdapter.execute.mockResolvedValue({
        output: { images: [{ url: 'https://cdn.example.com/img.png' }] },
      });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/img.png' });

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // Adapter should receive the provider's sdkModelId
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ sdkModelId: 'openai/gpt-image-2:abc123' }),
        expect.any(Object),
      );
    });

    it('无可用 provider 时应失败', async () => {
      mockProviderService.getAvailableProviders.mockResolvedValue([]);

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '模型 "doubao-seedream-5-0" 没有可用的渠道' },
      });
    });

    it('providerAttempt 记录包含 Provider 的单次和按秒采购成本', async () => {
      const provider = { platformName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc', sdkClient: 'replicate', priority: 1, costPerCall: 0.05, costPerSecond: 0.004, config: {} };
      mockProviderService.getAvailableProviders.mockResolvedValue([provider]);

      mockAdapter.execute.mockResolvedValue({
        output: { images: [{ url: 'https://cdn.example.com/img.png' }] },
      });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/img.png' });

      const spy = vi.spyOn(service as any, 'recordProviderAttempt');

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          costPerCall: 0.05,
          costPerSecond: 0.004,
          providerName: 'replicate',
          status: 'success',
        }),
      );

      spy.mockRestore();
    });
  });

  // ===== Create 级别 WebSocket 事件 =====

  describe('Create WS 事件推送', () => {
    it('任务有 createId 时应推送 create:status (processing)', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'ok' } });
      // Set mock to return task with createId
      db._result = [{ id: 'task-1', createId: 'create-1' }];

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'create:status',
        payload: { createId: 'create-1', status: 'processing' },
      });
    });

    it('任务完成时应推送 create:status (completed)', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });
      db._result = [{ id: 'task-1', createId: 'create-1' }];

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'create:status',
        payload: { createId: 'create-1', status: 'completed', output: expect.objectContaining({ content: 'done' }) },
      });

      // syncCreateStatus should also be called
      expect(mockCreateService.syncCreateStatus).toHaveBeenCalledWith('create-1', 'completed', expect.any(Object));
    });

    it('任务失败时应推送 create:status (failed)', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('模型超时'));
      db._result = [{ id: 'task-1', createId: 'create-1' }];

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'create:status',
        payload: { createId: 'create-1', status: 'failed', errorMessage: '所有渠道均失败: 模型超时' },
      });

      expect(mockCreateService.syncCreateStatus).toHaveBeenCalledWith('create-1', 'failed', undefined, '所有渠道均失败: 模型超时');
    });

    it('onProgress 回调应推送 create:progress', async () => {
      mockAdapter.execute.mockImplementation(async (_input, _model, ctx) => {
        ctx.onProgress(60, '正在生成...');
        return { output: { content: 'ok' } };
      });
      db._result = [{ id: 'task-1', createId: 'create-1' }];

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'create:progress',
        payload: { createId: 'create-1', progress: 60, message: '正在生成...' },
      });
    });

    it('任务无 createId 时不推送 create 事件', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'ok' } });
      // Default mock returns empty array — no createId
      db._result = [];

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      const createEvents = mockWsService.sendToUser.mock.calls.filter(
        ([, msg]) => typeof msg.type === 'string' && msg.type.startsWith('create:'),
      );
      expect(createEvents).toHaveLength(0);
    });
  });
});
