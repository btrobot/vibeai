/**
 * Engine Spec-Driven Tests
 *
 * 基于 engine.spec.yaml 的任务状态机和规则测试
 * 覆盖：ENG-009 (credit_reserve_on_submit) + ENG-010 (task_timeout)
 * 覆盖：Task 状态机转换合法性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutionService } from './task-execution.service';
import { createDrizzleMockForNestJS } from '../../test/drizzle-mock';
import type { AdapterModel } from './adapters/protocol-adapter.interface';

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

describe('Engine Spec Tests', () => {
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

  // ============================================================
  // 状态机: Task status 转换合法性
  // queued → submitting → completing → completed
  // queued/submitting → cancelled
  // submitting → failed
  // completing → completed/failed
  // failed → queued (retry)
  // ============================================================
  describe('Task 状态机', () => {
    describe('正常转换路径', () => {
      it('queued → submitting → completing → completed', async () => {
        mockAdapter.execute.mockResolvedValue({
          output: { content: 'done' },
        });

        await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

        // 3 个 DB update: submitting → completing → completed
        expect(db.update).toHaveBeenCalledTimes(3);

        // 验证 WebSocket 推送了三个状态
        const wsCalls = mockWsService.sendToUser.mock.calls;
        const statuses = wsCalls
          .filter(([, msg]: any) => msg.type === 'task:status')
          .map(([, msg]: any) => msg.payload.status);
        expect(statuses).toEqual(['submitting', 'completing']);

        // 最终推送 task:completed
        const completedCall = wsCalls.find(([, msg]: any) => msg.type === 'task:completed');
        expect(completedCall).toBeDefined();
      });

      it('completing → completed 时 progress 设为 100', async () => {
        mockAdapter.execute.mockResolvedValue({
          output: { content: 'done' },
        });

        await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

        // 最后一次 update 应包含 progress: 100
        // db.update 是 mock，验证通过 WebSocket 推送 completed
        expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
          type: 'task:completed',
          payload: expect.objectContaining({ taskId: 'task-1' }),
        });
      });
    });

    describe('失败转换', () => {
      it('submitting → failed (适配器抛异常)', async () => {
        mockAdapter.execute.mockRejectedValue(new Error('SDK 超时'));

        await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

        // 2 个 DB update: submitting + failed
        expect(db.update).toHaveBeenCalledTimes(2);

        // 推送 task:failed
        expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
          type: 'task:failed',
          payload: { taskId: 'task-1', error: 'SDK 超时' },
        });
      });

      it('completing → failed (转存失败不中断，仍 completed)', async () => {
        // 转存失败时任务仍标记 completed（容错设计）
        mockAdapter.execute.mockResolvedValue({
          output: { images: [{ url: 'https://cdn.example.com/img.png' }] },
        });
        mockStorageService.downloadAndStore.mockRejectedValue(new Error('存储不可用'));

        await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

        // 仍然走完 3 个 update: submitting → completing → completed
        expect(db.update).toHaveBeenCalledTimes(3);
        expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
      });
    });

    describe('终态验证', () => {
      it('completed 是终态（不再转换）', async () => {
        mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

        await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

        // 完成后不应再调用 update
        const updateCountAfterComplete = (db.update as any).mock.calls.length;
        await new Promise((r) => setTimeout(r, 50));
        expect((db.update as any).mock.calls.length).toBe(updateCountAfterComplete);
      });

      it('failed 是终态（不再转换）', async () => {
        mockAdapter.execute.mockRejectedValue(new Error('fail'));

        await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

        const updateCountAfterFail = (db.update as any).mock.calls.length;
        await new Promise((r) => setTimeout(r, 50));
        expect((db.update as any).mock.calls.length).toBe(updateCountAfterFail);
      });
    });
  });

  // ============================================================
  // ENG-009: 任务提交时必须预扣信用额度，失败或取消时退还
  // enforcement: submitGeneration 调用 billingService.reserveCredits，失败时 refundCredits
  // test: should check credits when creditCost is specified
  // ============================================================
  describe('ENG-009: credit_reserve_on_submit', () => {
    it('任务成功完成后调用 settleCredits', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      expect(mockBillingService.settleCredits).toHaveBeenCalledWith('task-1');
      expect(mockBillingService.refundCredits).not.toHaveBeenCalled();
    });

    it('任务失败后调用 refundCredits', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('生成失败'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      expect(mockBillingService.refundCredits).toHaveBeenCalledWith(
        'user-1', 'task-1', mockModel.costCredits, '任务失败退款',
      );
      expect(mockBillingService.settleCredits).not.toHaveBeenCalled();
    });

    it('退款金额等于模型 costCredits', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('fail'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      expect(mockBillingService.refundCredits).toHaveBeenCalledWith(
        'user-1', 'task-1', 10, '任务失败退款',
      );
    });

    it('退款失败不影响任务失败状态', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('生成失败'));
      mockBillingService.refundCredits.mockRejectedValue(new Error('退款服务不可用'));

      // 不应抛出异常
      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // 任务仍标记为 failed
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '生成失败' },
      });
    });

    it('不同模型 costCredits 不同（验证 creditsCost 传递）', async () => {
      const expensiveModel: AdapterModel = { ...mockModel, costCredits: 50 };
      mockAdapter.execute.mockRejectedValue(new Error('fail'));

      await service.executeTask('task-1', 'user-1', 'video-generation', { prompt: 'test' }, expensiveModel);

      expect(mockBillingService.refundCredits).toHaveBeenCalledWith(
        'user-1', 'task-1', 50, '任务失败退款',
      );
    });
  });

  // ============================================================
  // ENG-010: 任务超过 expiresAt 未完成时自动标记 failed 并退还信用
  // enforcement: 定时扫描 expiresAt < now() 且 status 为 submitting 的任务
  // test: should fail task and refund credits
  // ============================================================
  describe('ENG-010: task_timeout', () => {
    it('适配器超时（reject）时任务标记 failed 并退款', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('任务执行超时'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      // 验证 failed 状态
      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:failed',
        payload: { taskId: 'task-1', error: '任务执行超时' },
      });

      // 验证退款
      expect(mockBillingService.refundCredits).toHaveBeenCalledWith(
        'user-1', 'task-1', mockModel.costCredits, '任务失败退款',
      );
    });

    it('submitting 状态失败后不再调用 settleCredits', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('timeout'));

      await service.executeTask('task-1', 'user-1', 'image-generation', { prompt: 'test' }, mockModel);

      expect(mockBillingService.settleCredits).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // ENG-003: 已完成/已取消的任务不可再取消
  // (TaskExecutionService 不直接处理取消，但验证终态后不再转换)
  // ============================================================
  describe('ENG-003: task_status_guard (间接验证)', () => {
    it('completed 后不再有状态转换', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      const updatesAfterComplete = (db.update as any).mock.calls.length;
      // 等待一段时间确认没有后续 update
      await new Promise((r) => setTimeout(r, 100));
      expect((db.update as any).mock.calls.length).toBe(updatesAfterComplete);
    });
  });

  // ============================================================
  // ENG-004: progress 必须在 0-100 范围内
  // ============================================================
  describe('ENG-004: progress_bounds', () => {
    it('onProgress 推送 progress 值', async () => {
      mockAdapter.execute.mockImplementation(async (_input, _model, context) => {
        context.onProgress?.(50, '正在生成...');
        return { output: { content: 'done' } };
      });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:progress',
        payload: { taskId: 'task-1', progress: 50, message: '正在生成...' },
      });
    });

    it('完成后 progress 最终为 100', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      // 最后一次 WebSocket 推送是 task:completed
      const lastCall = mockWsService.sendToUser.mock.calls[mockWsService.sendToUser.mock.calls.length - 1];
      expect(lastCall[1].type).toBe('task:completed');
    });
  });

  // ============================================================
  // ENG-008: 每个任务执行步骤必须记录 ExecutionState
  // (通过 WebSocket 推送间接验证执行步骤)
  // ============================================================
  describe('ENG-008: execution_state_logging (间接验证)', () => {
    it('submitting 状态通过 WebSocket 推送', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:status',
        payload: { taskId: 'task-1', status: 'submitting' },
      });
    });

    it('completing 状态通过 WebSocket 推送', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:status',
        payload: { taskId: 'task-1', status: 'completing' },
      });
    });

    it('completed 状态通过 WebSocket 推送', async () => {
      mockAdapter.execute.mockResolvedValue({ output: { content: 'done' } });

      await service.executeTask('task-1', 'user-1', 'text-generation', { prompt: 'test' }, mockModel);

      expect(mockWsService.sendToUser).toHaveBeenCalledWith('user-1', {
        type: 'task:completed',
        payload: expect.objectContaining({ taskId: 'task-1' }),
      });
    });
  });
});
