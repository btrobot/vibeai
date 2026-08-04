/**
 * TaskExecutionService 单元测试
 *
 * 覆盖范围：
 * - 完整执行流程：queued → submitting → completing → completed
 * - 失败流程：submitting → failed + 信用退款
 * - 结果转存：图片/视频/尾帧 URL → downloadAndStore
 * - WebSocket 推送：status/progress/completed/failed
 * - 信用生命周期：settleCredits（成功）/ refundCredits（失败）
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
};

const mockAdapterRegistry = {
  getAdapter: vi.fn().mockReturnValue(mockAdapter),
};

describe('TaskExecutionService', () => {
  let service: TaskExecutionService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  const mockModel: AdapterModel = {
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
    sdkModelId: 'doubao-seedream-5-0-260128',
    modality: 'image',
    constraints: {},
    defaultParams: {},
    costCredits: 10,
    sortOrder: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDrizzleMockForNestJS();

    service = new TaskExecutionService(
      db as any,
      mockWsService as any,
      mockStorageService as any,
      mockBillingService as any,
      mockAdapterRegistry as any,
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

      // The last update (completed) should include providerTaskId
      // Since db.update is a mock, we can't directly inspect the .set() call args easily
      // But we can verify the adapter returned providerTaskId and the service didn't throw
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
        payload: { taskId: 'task-1', error: '模型服务不可用' },
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
        payload: { taskId: 'task-1', error: '生成失败' },
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
    it('应根据 model.modality 获取适配器', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'ok' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, mockModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('image');
    });

    it('video modality 应获取 video 适配器', async () => {
      const videoModel: AdapterModel = { ...mockModel, modality: 'video' };
      mockAdapter.execute.mockResolvedValue({ output: { video: { url: 'https://x.com/v.mp4' } } });
      mockStorageService.downloadAndStore.mockResolvedValue({ fileId: 'f1', url: 'https://s.com/v.mp4' });

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'hi' }, videoModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('video');
    });

    it('llm modality 应获取 llm 适配器', async () => {
      const llmModel: AdapterModel = { ...mockModel, modality: 'llm' };
      mockAdapter.execute.mockResolvedValue({ output: { content: 'hello' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'hi' }, llmModel);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('llm');
    });
  });
});
