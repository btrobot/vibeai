import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { BillingService } from '../billing/billing.service';
import type { Response } from 'express';

// ===== Mocks =====

const mockGatewayService = {
  listCapabilities: vi.fn(),
  getCapability: vi.fn(),
  listModels: vi.fn(),
  getModel: vi.fn(),
  getDefaultModel: vi.fn(),
  listRecipes: vi.fn(),
  submitGeneration: vi.fn(),
  quickCreate: vi.fn(),
};

const mockAdapterRegistry = {
  getAdapter: vi.fn(),
};

const mockBillingService = {
  deductCredits: vi.fn(),
  reserveCredits: vi.fn(),
  refundCredits: vi.fn(),
  settleCredits: vi.fn(),
};

// ===== Helpers =====

function createMockResponse(): Response & { _data: unknown[]; _ended: boolean; _headers: Record<string, string> } {
  const res = {
    _data: [] as unknown[],
    _ended: false,
    _headers: {} as Record<string, string>,
    setHeader: vi.fn((key: string, value: string) => {
      (res as any)._headers[key] = value;
    }),
    flushHeaders: vi.fn(),
    write: vi.fn((data: string) => {
      (res as any)._data.push(data);
    }),
    end: vi.fn(() => {
      (res as any)._ended = true;
    }),
  };
  return res as any;
}

function createMockRequest(overrides: Record<string, unknown> = {}): any {
  return {
    user: { userId: 'user-1' },
    query: {},
    ...overrides,
  };
}

describe('GatewayController', () => {
  let controller: GatewayController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GatewayController(
      mockGatewayService as any,
      mockAdapterRegistry as any,
      mockBillingService as any,
    );
  });

  // ===== listCapabilities =====

  describe('GET /gateway/capabilities', () => {
    it('应返回能力列表', () => {
      const caps = [{ slug: 'text-generation', name: '文本生成' }];
      mockGatewayService.listCapabilities.mockReturnValue(caps);

      const result = controller.listCapabilities();

      expect(result).toEqual({ success: true, data: caps });
      expect(mockGatewayService.listCapabilities).toHaveBeenCalledOnce();
    });
  });

  // ===== getCapability =====

  describe('GET /gateway/capabilities/:slug', () => {
    it('能力存在时应返回详情', () => {
      const cap = { slug: 'text-generation', name: '文本生成' };
      mockGatewayService.getCapability.mockReturnValue(cap);

      const result = controller.getCapability('text-generation');

      expect(result).toEqual({ success: true, data: cap });
    });

    it('能力不存在时应抛出 NotFoundException', () => {
      mockGatewayService.getCapability.mockReturnValue(null);

      expect(() => controller.getCapability('unknown')).toThrow('能力 "unknown" 不存在');
    });
  });

  // ===== listModels =====

  describe('GET /gateway/models', () => {
    it('应返回模型列表', async () => {
      const models = [{ slug: 'doubao-seed-2-0-pro', modality: 'llm' }];
      mockGatewayService.listModels.mockResolvedValue(models);

      const result = await controller.listModels(createMockRequest());

      expect(result).toEqual({ success: true, data: models });
      expect(mockGatewayService.listModels).toHaveBeenCalledWith(undefined, undefined);
    });

    it('应支持 ?capability= 过滤', async () => {
      const models = [{ slug: 'doubao-seedream-5-0', modality: 'image' }];
      mockGatewayService.listModels.mockResolvedValue(models);

      const result = await controller.listModels(
        createMockRequest({ query: { capability: 'image-generation' } }),
      );

      expect(result).toEqual({ success: true, data: models });
      expect(mockGatewayService.listModels).toHaveBeenCalledWith('image-generation', undefined);
    });

    it('应支持 ?modality= 过滤', async () => {
      const models = [{ slug: 'gpt-image-2', modality: 'image' }];
      mockGatewayService.listModels.mockResolvedValue(models);

      const result = await controller.listModels(
        createMockRequest({ query: { modality: 'image' } }),
      );

      expect(result).toEqual({ success: true, data: models });
      expect(mockGatewayService.listModels).toHaveBeenCalledWith(undefined, 'image');
    });
  });

  // ===== getModel =====

  describe('GET /gateway/models/:slug', () => {
    it('模型存在时应返回详情', async () => {
      const model = { slug: 'doubao-seed-2-0-pro', modality: 'llm' };
      mockGatewayService.getModel.mockResolvedValue(model);

      const result = await controller.getModel('doubao-seed-2-0-pro');

      expect(result).toEqual({ success: true, data: model });
    });

    it('模型不存在时应抛出 NotFoundException', async () => {
      mockGatewayService.getModel.mockResolvedValue(null);

      await expect(controller.getModel('unknown')).rejects.toThrow('模型 "unknown" 不存在');
    });
  });

  // ===== 模型出口脱敏（模型级 key 不回显）=====

  describe('模型出口脱敏', () => {
    it('GET /gateway/models 移除 defaultParams 中的 apiKey/token', async () => {
      mockGatewayService.listModels.mockResolvedValue([
        { slug: 'gpt-4o', name: 'GPT-4o', defaultParams: { apiKey: 'sk-secret', temperature: 0.7 }, costCredits: 3 },
      ]);

      const result = await controller.listModels(createMockRequest());

      expect(result.data[0].defaultParams.apiKey).toBeUndefined();
      expect(result.data[0].defaultParams.temperature).toBe(0.7);
    });

    it('GET /gateway/models/:slug 移除 defaultParams 中的密钥', async () => {
      mockGatewayService.getModel.mockResolvedValue({
        slug: 'gpt-4o',
        defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-secret' },
      });

      const result = await controller.getModel('gpt-4o');

      expect(result.data.defaultParams.apiKey).toBeUndefined();
      expect(result.data.defaultParams.baseUrl).toBe('https://cn.pptoken.cc/v1');
    });
  });

  // ===== listRecipes =====

  describe('GET /gateway/recipes', () => {
    it('应返回配方列表', () => {
      const recipes = [{ id: 'text-to-image', name: '文生图' }];
      mockGatewayService.listRecipes.mockReturnValue(recipes);

      const result = controller.listRecipes();

      expect(result).toEqual({ success: true, data: recipes });
      expect(mockGatewayService.listRecipes).toHaveBeenCalledOnce();
    });
  });

  // ===== generate =====

  describe('POST /gateway/generate', () => {
    it('应提交生成任务并返回 queued 状态', async () => {
      const taskResponse = {
        taskId: 'task-1',
        status: 'queued' as const,
        capabilitySlug: 'image-generation',
        modelSlug: 'doubao-seedream-5-0',
        createdAt: '2025-01-01T00:00:00.000Z',
        createId: 'create-1',
      };
      mockGatewayService.submitGeneration.mockResolvedValue(taskResponse);

      const result = await controller.generate(
        createMockRequest(),
        { capabilitySlug: 'image-generation', input: { prompt: '一只猫' }, projectId: 'proj-1' },
      );

      expect(result).toEqual({ success: true, data: taskResponse });
      expect(mockGatewayService.submitGeneration).toHaveBeenCalledWith(
        'user-1',
        'proj-1',
        'image-generation',
        { prompt: '一只猫' },
        undefined,
        undefined,
      );
    });

    it('应传递 modelSlug 参数', async () => {
      const taskResponse = { taskId: 'task-1', status: 'queued' as const, capabilitySlug: 'text-generation', modelSlug: 'kimi-k2-5', createdAt: '2025-01-01T00:00:00.000Z', createId: 'create-1' };
      mockGatewayService.submitGeneration.mockResolvedValue(taskResponse);

      await controller.generate(
        createMockRequest(),
        { capabilitySlug: 'text-generation', modelSlug: 'kimi-k2-5', input: { prompt: '你好' }, projectId: 'proj-1' },
      );

      expect(mockGatewayService.submitGeneration).toHaveBeenCalledWith(
        'user-1',
        'proj-1',
        'text-generation',
        { prompt: '你好' },
        'kimi-k2-5',
        undefined,
      );
    });
  });

  // ===== quickCreate =====

  describe('POST /gateway/quick-create', () => {
    it('应通过配方提交生成任务', async () => {
      const taskResponse = { taskId: 'task-1', status: 'queued' as const, capabilitySlug: 'image-generation', modelSlug: 'doubao-seedream-5-0', createdAt: '2025-01-01T00:00:00.000Z', createId: 'create-1' };
      mockGatewayService.quickCreate.mockResolvedValue(taskResponse);

      const result = await controller.quickCreate(
        createMockRequest(),
        { recipeId: 'text-to-image', input: { prompt: '一只猫' }, projectId: 'proj-1' },
      );

      expect(result).toEqual({ success: true, data: taskResponse });
      expect(mockGatewayService.quickCreate).toHaveBeenCalledWith('user-1', 'proj-1', 'text-to-image', { prompt: '一只猫' });
    });

    it('应支持无 input 的配方调用', async () => {
      const taskResponse = { taskId: 'task-2', status: 'queued' as const, capabilitySlug: 'text-generation', modelSlug: 'doubao-seed-2-0-pro', createdAt: '2025-01-01T00:00:00.000Z', createId: 'create-2' };
      mockGatewayService.quickCreate.mockResolvedValue(taskResponse);

      await controller.quickCreate(
        createMockRequest(),
        { recipeId: 'prompt-enhance', projectId: 'proj-1' },
      );

      expect(mockGatewayService.quickCreate).toHaveBeenCalledWith('user-1', 'proj-1', 'prompt-enhance', undefined);
    });
  });

  // ===== chat (SSE) =====

  describe('POST /gateway/chat (SSE)', () => {
    it('应设置 SSE 响应头并流式输出 LLM 内容', async () => {
      const model = { slug: 'doubao-seed-2-0-pro', name: 'Doubao Pro', costCredits: 1, modality: 'llm' as const, sdkModelId: 'doubao-seed-2-0-pro-260215', constraints: {}, defaultParams: {}, sortOrder: 0 };
      mockGatewayService.getModel.mockResolvedValue(model);

      const mockAdapter = {
        execute: vi.fn().mockImplementation((_input, _model, ctx) => {
          ctx.onProgress(0, 'Hello');
          ctx.onProgress(50, 'Hello, world');
          return Promise.resolve({ output: { type: 'text', content: 'Hello, world' } });
        }),
      };
      mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockBillingService.deductCredits.mockResolvedValue(true);

      const res = createMockResponse();
      await controller.chat(
        createMockRequest(),
        { prompt: '你好', modelSlug: 'doubao-seed-2-0-pro' },
        res,
      );

      // Verify SSE headers
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
      expect(res.flushHeaders).toHaveBeenCalled();

      // Verify streaming output
      expect(res.write).toHaveBeenCalled();
      const writes = (res as any)._data as string[];
      expect(writes.length).toBeGreaterThanOrEqual(3); // 2 chunks + done

      // Verify done message
      const doneWrite = writes[writes.length - 1];
      expect(doneWrite).toContain('"done":true');
      expect(doneWrite).toContain('"modelUsed":"doubao-seed-2-0-pro"');

      // Verify credit deduction (LLM chat uses null as taskId, no Task record created)
      expect(mockBillingService.deductCredits).toHaveBeenCalledWith(
        'user-1',
        null,
        1,
        'LLM 对话: Doubao Pro',
      );

      // Verify response ended
      expect(res.end).toHaveBeenCalled();
    });

    it('按模型的 sdkClient 选择适配器（openai 协议模型）', async () => {
      const model = {
        slug: 'gpt-4o',
        name: 'GPT-4o (ppToken)',
        costCredits: 3,
        modality: 'llm' as const,
        sdkModelId: 'gpt-4o',
        sdkClient: 'openai',
        constraints: {},
        defaultParams: { baseUrl: 'https://cn.pptoken.cc/v1' },
        sortOrder: 0,
      };
      mockGatewayService.getModel.mockResolvedValue(model);
      const mockAdapter = {
        execute: vi.fn().mockImplementation((_i, _m, c) => {
          c.onProgress(0, 'ok');
          return Promise.resolve({ output: { content: 'ok' } });
        }),
      };
      mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockBillingService.deductCredits.mockResolvedValue(true);

      const res = createMockResponse();
      await controller.chat(createMockRequest(), { prompt: '你好', modelSlug: 'gpt-4o' }, res);

      expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('openai');
      expect(mockAdapter.execute).toHaveBeenCalledTimes(1);
      expect(res.end).toHaveBeenCalled();
    });

    it('无 modelSlug 时应使用默认文本生成模型', async () => {
      const model = { slug: 'doubao-seed-2-0-pro', name: 'Doubao Pro', costCredits: 1, modality: 'llm' as const, sdkModelId: 'doubao-seed-2-0-pro-260215', constraints: {}, defaultParams: {}, sortOrder: 0 };
      mockGatewayService.getDefaultModel.mockResolvedValue(model);

      const mockAdapter = {
        execute: vi.fn().mockResolvedValue({ output: { type: 'text', content: 'OK' } }),
      };
      mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockBillingService.deductCredits.mockResolvedValue(true);

      const res = createMockResponse();
      await controller.chat(
        createMockRequest(),
        { prompt: '你好' },
        res,
      );

      expect(mockGatewayService.getDefaultModel).toHaveBeenCalledWith('text-generation');
      expect(mockGatewayService.getModel).not.toHaveBeenCalled();
    });

    it('没有可用模型时应抛出 NotFoundException', async () => {
      mockGatewayService.getModel.mockResolvedValue(null);
      mockGatewayService.getDefaultModel.mockResolvedValue(null);

      const res = createMockResponse();

      await expect(
        controller.chat(createMockRequest(), { prompt: '你好' }, res),
      ).rejects.toThrow('没有可用的文本生成模型');
    });

    it('适配器执行失败时应通过 SSE 返回错误信息', async () => {
      const model = { slug: 'doubao-seed-2-0-pro', name: 'Doubao Pro', costCredits: 1, modality: 'llm' as const, sdkModelId: 'doubao-seed-2-0-pro-260215', constraints: {}, defaultParams: {}, sortOrder: 0 };
      mockGatewayService.getModel.mockResolvedValue(model);

      const mockAdapter = {
        execute: vi.fn().mockRejectedValue(new Error('LLM 服务不可用')),
      };
      mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);

      const res = createMockResponse();
      await controller.chat(
        createMockRequest(),
        { prompt: '你好', modelSlug: 'doubao-seed-2-0-pro' },
        res,
      );

      // Verify error in SSE
      const writes = (res as any)._data as string[];
      expect(writes.some((w) => w.includes('"error"') && w.includes('LLM 服务不可用'))).toBe(true);

      // Verify credit NOT deducted on failure
      expect(mockBillingService.deductCredits).not.toHaveBeenCalled();

      // Verify response ended
      expect(res.end).toHaveBeenCalled();
    });

    it('流式过程中应通过 onProgress 推送每个 chunk', async () => {
      const model = { slug: 'doubao-seed-2-0-pro', name: 'Doubao Pro', costCredits: 1, modality: 'llm' as const, sdkModelId: 'doubao-seed-2-0-pro-260215', constraints: {}, defaultParams: {}, sortOrder: 0 };
      mockGatewayService.getDefaultModel.mockResolvedValue(model);

      const chunks = ['你', '好', '世界'];
      const mockAdapter = {
        execute: vi.fn().mockImplementation((_input, _model, ctx) => {
          chunks.forEach((c, i) => ctx.onProgress((i + 1) * 33, c));
          return Promise.resolve({ output: { type: 'text', content: chunks.join('') } });
        }),
      };
      mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockBillingService.deductCredits.mockResolvedValue(true);

      const res = createMockResponse();
      await controller.chat(createMockRequest(), { prompt: '你好' }, res);

      const writes = (res as any)._data as string[];
      // 3 chunks + 1 done = 4 writes
      expect(writes.length).toBe(4);

      // Verify each chunk is in SSE format
      expect(writes[0]).toBe(`data: ${JSON.stringify({ content: '你' })}\n\n`);
      expect(writes[1]).toBe(`data: ${JSON.stringify({ content: '好' })}\n\n`);
      expect(writes[2]).toBe(`data: ${JSON.stringify({ content: '世界' })}\n\n`);
      expect(writes[3]).toContain('"done":true');
    });
  });
});
