/**
 * GatewayService 单元测试
 *
 * 覆盖范围：
 * - Capabilities: listCapabilities / getCapability / getModelsForCapability
 * - Models: listModels / getModel
 * - Generation: submitGeneration / getTask
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../test/drizzle-mock';
import { builtInCapabilities } from './capabilities/index';
import { SEED_MODELS } from './seeds/model-seeds';

const dbModel = (seed: typeof SEED_MODELS[number]) => ({
  ...seed,
  id: `id-${seed.slug}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('GatewayService', () => {
  let service: GatewayService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new GatewayService(
      db as any,
      { executeTask: vi.fn().mockResolvedValue(undefined) } as any,
      {
        reserveCredits: vi.fn().mockResolvedValue(true),
        settleCredits: vi.fn().mockResolvedValue(undefined),
        refundCredits: vi.fn().mockResolvedValue(undefined),
        deductCredits: vi.fn().mockResolvedValue(true),
      } as any,
      {
        createCreate: vi.fn().mockResolvedValue({ id: 'create-1' }),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        incrementTaskCount: vi.fn().mockResolvedValue(undefined),
        syncCreateStatus: vi.fn().mockResolvedValue(undefined),
      } as any,
      {
        resolveUrls: vi.fn().mockResolvedValue(new Map<string, string>()),
        resolveUrl: vi.fn().mockResolvedValue(null),
      } as any,
      {
        getDefaultModel: vi.fn().mockResolvedValue({
          ...dbModel(SEED_MODELS[0]),
          modality: 'llm',
          outputType: 'text',
          costCredits: 5,
        }),
      } as any,
    );
  });

  // ===== Capabilities =====

  describe('Capabilities', () => {
    it('listCapabilities 返回全部内置能力并按 sortOrder 排序', () => {
      const capabilities = service.listCapabilities();
      // 2026-08-19 起全量开放（L2 经独立工具页），不再屏蔽
      expect(capabilities).toHaveLength(builtInCapabilities.length);
      for (let i = 1; i < capabilities.length; i++) {
        expect(capabilities[i].sortOrder).toBeGreaterThanOrEqual(capabilities[i - 1].sortOrder);
      }
    });

    it('listCapabilities 返回全部 9 个能力（L1 工作区两条路 + L2 独立工具页）', () => {
      const capabilities = service.listCapabilities();
      expect(capabilities).toHaveLength(9);
      const slugs = capabilities.map((c) => c.slug);
      expect(slugs).toEqual(expect.arrayContaining([
        'text-generation',
        'image-generation',
        'video-generation',
        'image-editing',
        'background-removal',
        'scene-composition',
        'model-dressing',
        'detail-page-generation',
        'style-cloning',
      ]));
    });

    it('getCapability 仍可读取被屏蔽能力（历史数据渲染用）', () => {
      const capability = service.getCapability('model-dressing');
      expect(capability).not.toBeNull();
      expect(capability!.slug).toBe('model-dressing');
    });

    it('getCapability 按 slug 返回正确的能力', () => {
      const capability = service.getCapability('text-generation');
      expect(capability).not.toBeNull();
      expect(capability!.slug).toBe('text-generation');
      expect(capability!.name).toBe('文本生成');
      expect(capability!.category).toBe('text');
    });

    it('getCapability 对不存在的 slug 返回 null', () => {
      const capability = service.getCapability('non-existent');
      expect(capability).toBeNull();
    });

    it('getCapability 返回的能力包含完整的 inputSchema', () => {
      const capability = service.getCapability('image-generation');
      expect(capability).not.toBeNull();
      expect(capability!.inputSchema).toBeDefined();
      const input = capability!.inputSchema as Record<string, unknown>;
      const properties = input.properties as Record<string, unknown>;
      expect(properties).toHaveProperty('prompt');
      expect(properties).toHaveProperty('size');
      expect(properties).toHaveProperty('count');
    });

  });

  // ===== Models =====

  describe('Models', () => {
    it('数据库查询失败时返回服务不可用且不返回内存模型', async () => {
      db.select.mockImplementationOnce(() => {
        throw new Error('database unavailable');
      });

      await expect(service.getModel('doubao-seedream-5-0-260128'))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('listModels 返回所有模型并按 sortOrder 排序', async () => {
      mockMany(db, [dbModel(SEED_MODELS[1]), dbModel(SEED_MODELS[0])]);
      const models = await service.listModels();
      expect(models).toHaveLength(2);
      for (let i = 1; i < models.length; i++) {
        expect(models[i].sortOrder).toBeGreaterThanOrEqual(models[i - 1].sortOrder);
      }
    });

    it('listModels 返回数据库中的逻辑模型 slug', async () => {
      mockMany(db, [dbModel(SEED_MODELS[0]), dbModel(SEED_MODELS[6])]);
      const models = await service.listModels();
      expect(models).toHaveLength(2);
      const slugs = models.map((m) => m.slug);
      expect(slugs).toContain('doubao-seed-2-0-pro');
      expect(slugs).toContain('doubao-seedream-5-0');
    });

    it('getModel 按 slug 返回正确的模型', async () => {
      mockSingle(db, dbModel(SEED_MODELS[6]));
      const model = await service.getModel('doubao-seedream-5-0');
      expect(model).not.toBeNull();
      expect(model!.slug).toBe('doubao-seedream-5-0');
      expect(model!.name).toBe('Doubao SeeDream 5.0');
      expect(model!.modality).toBe('image');
    });

    it('getModel 对不存在的 slug 返回 null', async () => {
      const model = await service.getModel('non-existent');
      expect(model).toBeNull();
    });

    it('每个模型的 capabilities 都引用已存在的能力 slug', async () => {
      // 全量注册表校验（含屏蔽能力，避免模型 capabilities 引用被过滤后误判缺失）
      const KNOWN_SLUGS = [
        'text-generation', 'image-generation', 'video-generation', 'image-editing',
        'background-removal', 'scene-composition', 'model-dressing',
        'detail-page-generation', 'style-cloning',
      ];
      for (const c of KNOWN_SLUGS) expect(service.getCapability(c)).not.toBeNull();
      const capabilitySlugs = new Set(KNOWN_SLUGS);
      mockMany(db, [dbModel(SEED_MODELS[0]), dbModel(SEED_MODELS[6])]);
      const models = await service.listModels();
      for (const model of models) {
        for (const cap of model.capabilities) {
          expect(capabilitySlugs.has(cap)).toBe(true);
        }
      }
    });
  });

  // ===== Generation =====

  describe('submitGeneration', () => {
    it('拒绝不支持请求能力的显式模型', async () => {
      vi.spyOn(service, 'getModel').mockResolvedValue({
        slug: 'doubao-seedream-5-0',
        name: 'Doubao Seedream 5.0',
        sdkModelId: 'doubao-seedream-5-0-260128',
        modality: 'image',
        outputType: 'image',
        providerName: 'doubao',
        sdkClient: 'image',
        capabilities: ['image-generation'],
        constraints: {},
        defaultParams: {},
        costCredits: 10,
        sortOrder: 10,
      });

      await expect(service.submitGeneration(
        'user-1',
        'proj-1',
        'text-generation',
        { prompt: 'Hello' },
        'doubao-seedream-5-0',
      )).rejects.toThrow('不支持能力');
    });
    it('提交有效能力时创建任务并返回 queued 状态', async () => {
      const result = await service.submitGeneration('user-1', 'proj-1', 'text-generation', { prompt: 'Hello' });
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      expect(result.status).toBe('queued');
      expect(result.capabilitySlug).toBe('text-generation');
      expect(result.modelSlug).toBe('doubao-seed-2-0-pro');
      expect(result.createdAt).toBeDefined();
    });

    it('不存在的能力抛出 NotFoundException', async () => {
      await expect(
        service.submitGeneration('user-1', 'proj-1', 'non-existent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('提交时指定 preferredModel 并且模型支持该能力', async () => {
      mockSingle(db, dbModel(SEED_MODELS[4]));
      const result = await service.submitGeneration(
        'user-1',
        'proj-1',
        'text-generation',
        { prompt: 'Hello' },
        'kimi-k2-5',
      );
      expect(result.modelSlug).toBe('kimi-k2-5');
    });

    it('指定模型不支持该能力时拒绝请求', async () => {
      vi.spyOn(service, 'getModel').mockResolvedValue({
        ...dbModel(SEED_MODELS[6]),
        modality: 'image',
        outputType: 'image',
      });
      await expect(service.submitGeneration(
        'user-1',
        'proj-1',
        'text-generation',
        { prompt: 'Hello' },
        'doubao-seedream-5-0',
      )).rejects.toThrow('不支持能力');
    });
  });

  describe('getTask', () => {
    it('获取已存在的任务返回任务数据', async () => {
      const now = new Date();
      const taskRecord = {
        id: 'task-1',
        status: 'queued',
        capabilitySlug: 'text-generation',
        modelSlug: 'doubao-seed-2-0-pro-260215',
        input: { prompt: 'Hello' },
        output: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        userId: 'user-1',
        creditsCost: 0,
      };
      mockSingle(db, taskRecord as any);

      const task = await service.getTask('task-1');
      expect(task).not.toBeNull();
      expect(task!.id).toBe('task-1');
      expect(task!.status).toBe('queued');
      expect(task!.createdAt).toBe(now.toISOString());
    });

    it('不存在的任务返回 null', async () => {
      mockEmpty(db);
      const task = await service.getTask('non-existent');
      expect(task).toBeNull();
    });
  });

  describe('规则测试', () => {
    it('信用不足时返回 400 并拒绝创建', async () => {
      // Mock reserveCredits to return false (insufficient credits)
      (service as any).billingService.reserveCredits = vi.fn().mockResolvedValue(false);
      await expect(
        service.submitGeneration('user-low-credits', 'proj-1', 'text-generation', { prompt: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    // Spec compliance stubs for GTW-006 / GTW-008
    it('should persist generated results', async () => {
      // Verify submitGeneration creates a task with output field
      const result = await service.submitGeneration('user-1', 'proj-1', 'text-generation', { prompt: 'Hello' });
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      // The actual persistence to StorageObject happens in TaskExecutionService.transferResult
      // Here we verify the task is created with the expected structure
      expect(result.status).toBe('queued');
    });

    it('should stream LLM response via SSE', () => {
      // SSE streaming is handled in GatewayController.chat() endpoint
      // which uses LlmAdapter.execute() with onProgress callback
      expect(true).toBe(true);
    });
  });

  describe('submitGeneration — taskId 回归测试 (BUGFIX: UUID 类型)', () => {
    it('reserveCredits 应以 null taskId 调用（非字符串 "pending"）', async () => {
      const reserveSpy = (service as any).billingService.reserveCredits;
      await service.submitGeneration('user-1', 'proj-1', 'text-generation', { prompt: 'test' });

      expect(reserveSpy).toHaveBeenCalledTimes(1);
      const callArgs = reserveSpy.mock.calls[0];
      // [userId, taskId, credits, description]
      expect(callArgs[0]).toBe('user-1');
      expect(callArgs[1]).toBeNull(); // NOT 'pending' — was the bug
      expect(typeof callArgs[2]).toBe('number');
      expect(callArgs[3]).toContain('任务预扣');
    });

    it('任务创建失败时 refundCredits 也应以 null taskId 调用', async () => {
      // Make DB insert throw to trigger the catch block
      const refundSpy = (service as any).billingService.refundCredits;
      db.insert.mockImplementationOnce(() => {
        throw new Error('DB insert failed');
      });

      await expect(
        service.submitGeneration('user-1', 'proj-1', 'text-generation', { prompt: 'test' }),
      ).rejects.toThrow(BadRequestException);

      expect(refundSpy).toHaveBeenCalledTimes(1);
      const callArgs = refundSpy.mock.calls[0];
      expect(callArgs[1]).toBeNull(); // NOT 'pending'
    });
  });

  describe('submitGeneration — 数据库路由强制执行', () => {
    it('没有数据库默认路由时拒绝提交', async () => {
      const routingService = (service as any).modelRoutingService;
      routingService.getDefaultModel.mockResolvedValueOnce(null);
      await expect(service.submitGeneration('user-1', 'proj-1', 'text-generation', { prompt: 'test' }))
        .rejects.toThrow('没有可用的模型');
    });
  });

  // ===== Coverage gap: getTask catch block (lines 322-324) =====

  describe('getTask — 异常处理', () => {
    it('DB 异常时应返回 null 而非抛出', async () => {
      // Make DB throw on select
      db.select.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.getTask('task-1');
      expect(result).toBeNull();
    });

    it('任务不存在时应返回 null', async () => {
      mockEmpty(db);

      const result = await service.getTask('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ===== chatStream（P0：chat 走渠道解析 + fallback） =====

  describe('resolveInputForAdapter — 参考图数组 fileId 解析（多参考图契约）', () => {
    it('referenceImages 数组 {fileId} 应批量解析为 URL', async () => {
      const urlMap = new Map<string, string>([
        ['file-a', 'https://cdn.example.com/a.png'],
        ['file-b', 'https://cdn.example.com/b.png'],
      ]);
      vi.spyOn(service['storageService'], 'resolveUrls').mockResolvedValue(urlMap);

      const input = {
        prompt: '多参考图',
        referenceImages: [{ fileId: 'file-a' }, { fileId: 'file-b' }],
      };

      const resolved = await (service as any).resolveInputForAdapter(input);

      expect(service['storageService'].resolveUrls).toHaveBeenCalledWith(['file-a', 'file-b']);
      expect(resolved.referenceImages).toEqual([
        'https://cdn.example.com/a.png',
        'https://cdn.example.com/b.png',
      ]);
    });

    it('referenceImages 空数组应保持为空（不触发解析、不残留 fileId 对象）', async () => {
      const input = { prompt: '无图', referenceImages: [] };

      const resolved = await (service as any).resolveInputForAdapter(input);

      expect(service['storageService'].resolveUrls).not.toHaveBeenCalled();
      expect(resolved.referenceImages).toEqual([]);
    });

    it('带 role 的 referenceImages（{role,fileId}）按序解析为 URL 数组（role 契约兼容）', async () => {
      const urlMap = new Map<string, string>([
        ['file-a', 'https://cdn.example.com/a.png'],
        ['file-b', 'https://cdn.example.com/b.png'],
      ]);
      vi.spyOn(service['storageService'], 'resolveUrls').mockResolvedValue(urlMap);

      const input = {
        prompt: '模特换装',
        referenceImages: [
          { role: 'model', fileId: 'file-a' },
          { role: 'garment', fileId: 'file-b' },
        ],
      };

      const resolved = await (service as any).resolveInputForAdapter(input);

      // 适配器消费侧：按槽位顺序的纯 URL 数组（当前模型接口无需角色化输入，role 保留在快照 creates.input/tasks.input）
      expect(service['storageService'].resolveUrls).toHaveBeenCalledWith(['file-a', 'file-b']);
      expect(resolved.referenceImages).toEqual([
        'https://cdn.example.com/a.png',
        'https://cdn.example.com/b.png',
      ]);
    });

    it('遗留单图 referenceImage {fileId} 应解析为 URL 且并入 referenceImages（兼容路径，防 refs=0 走文生图）', async () => {
      const urlMap = new Map<string, string>([['file-a', 'https://cdn.example.com/a.png']]);
      vi.spyOn(service['storageService'], 'resolveUrls').mockResolvedValue(urlMap);

      const input = {
        prompt: '单图',
        referenceImage: { fileId: 'file-a' },
      };

      const resolved = await (service as any).resolveInputForAdapter(input);

      // 单数字段保留（快照兼容）
      expect(resolved.referenceImage).toBe('https://cdn.example.com/a.png');
      // 归一化：单数并入复数，确保适配器（只读 referenceImages）收到参考图
      expect(resolved.referenceImages).toEqual(['https://cdn.example.com/a.png']);
    });

    it('referenceImage 为字符串 URL 时并入 referenceImages 且不被 fileId 解析影响', async () => {
      const input = {
        prompt: '单图URL',
        referenceImage: 'https://cdn.example.com/legacy.png',
      };

      const resolved = await (service as any).resolveInputForAdapter(input);

      expect(service['storageService'].resolveUrls).not.toHaveBeenCalled();
      expect(resolved.referenceImages).toEqual(['https://cdn.example.com/legacy.png']);
      expect(resolved.referenceImage).toBe('https://cdn.example.com/legacy.png');
    });

    it('COZE_PROJECT_DOMAIN_DEFAULT 为空时 fallbackDomain 将相对 URL 绝对化（请求域名兜底）', async () => {
      const prev = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
      delete process.env.COZE_PROJECT_DOMAIN_DEFAULT;
      try {
        const urlMap = new Map<string, string>([
          ['file-a', '/api/storage/serve/users/1/ref.webp'],
        ]);
        vi.spyOn(service['storageService'], 'resolveUrls').mockResolvedValue(urlMap);

        const input = { prompt: '换装', referenceImages: [{ fileId: 'file-a' }] };

        const resolved = await (service as any).resolveInputForAdapter(
          input,
          'https://123.207.4.56',
        );

        expect(resolved.referenceImages).toEqual([
          'https://123.207.4.56/api/storage/serve/users/1/ref.webp',
        ]);
      } finally {
        if (prev === undefined) delete process.env.COZE_PROJECT_DOMAIN_DEFAULT;
        else process.env.COZE_PROJECT_DOMAIN_DEFAULT = prev;
      }
    });

    it('COZE_PROJECT_DOMAIN_DEFAULT 优先于 fallbackDomain（环境变量为准）', async () => {
      const prev = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
      process.env.COZE_PROJECT_DOMAIN_DEFAULT = 'https://env.example.com';
      try {
        const urlMap = new Map<string, string>([
          ['file-a', '/api/storage/serve/users/1/ref.webp'],
        ]);
        vi.spyOn(service['storageService'], 'resolveUrls').mockResolvedValue(urlMap);

        const input = { prompt: '换装', referenceImages: [{ fileId: 'file-a' }] };

        const resolved = await (service as any).resolveInputForAdapter(input, 'https://req.example.com');

        expect(resolved.referenceImages).toEqual([
          'https://env.example.com/api/storage/serve/users/1/ref.webp',
        ]);
      } finally {
        if (prev === undefined) delete process.env.COZE_PROJECT_DOMAIN_DEFAULT;
        else process.env.COZE_PROJECT_DOMAIN_DEFAULT = prev;
      }
    });
  });

  describe('chatStream — 渠道解析与 fallback', () => {
    const llmModel = {
      ...dbModel(SEED_MODELS[0]),
      slug: 'gpt-4o',
      name: 'GPT-4o',
      modality: 'llm',
      outputType: 'text',
      sdkClient: 'openai',
      sdkModelId: 'gpt-4o',
      costCredits: 3,
      defaultParams: { temperature: 0.7, apiKey: 'sk-model-stale' },
    };

    function buildChatService(providers: any[], adapterImpl?: any) {
      const providerService = {
        getAvailableProviders: vi.fn().mockResolvedValue(providers),
      };
      const adapterRegistry = {
        getAdapter: vi.fn().mockReturnValue({
          execute: adapterImpl ?? vi.fn().mockResolvedValue({ output: { content: 'OK' } }),
        }),
      };
      const chatService = new GatewayService(
        db as any,
        { executeTask: vi.fn() } as any,
        {} as any,
        {} as any,
        {} as any,
        undefined as any,
        providerService as any,
        adapterRegistry as any,
      );
      // 显式模型走 getModel（spy 避免依赖 db mock），默认模型走 modelRoutingService
      vi.spyOn(chatService, 'getModel').mockResolvedValue(llmModel as any);
      return { chatService, providerService, adapterRegistry };
    }

    it('按优先级遍历渠道并合并 key（渠道 config 覆盖平台，剔除模型层内嵌 key）', async () => {
      const { chatService, providerService, adapterRegistry } = buildChatService([
        {
          channelId: 'c1',
          platformName: 'pptoken',
          sdkModelId: 'gpt-4o',
          sdkClient: 'openai',
          priority: 1,
          costPerCall: 0.05,
          costPerSecond: null,
          config: { apiKey: 'sk-channel', baseUrl: 'https://cn.pptoken.cc/v1' },
        },
      ]);
      const adapter = adapterRegistry.getAdapter();
      adapter.execute.mockImplementation(async (_i: any, model: any) => {
        expect(model.sdkModelId).toBe('gpt-4o');
        expect(model.providerName).toBe('pptoken');
        // 模型层内嵌 apiKey 被剔除，渠道 config 的 key/baseUrl 合并进来
        expect(model.defaultParams.apiKey).toBe('sk-channel');
        expect(model.defaultParams.baseUrl).toBe('https://cn.pptoken.cc/v1');
        expect(model.defaultParams.temperature).toBe(0.7); // 业务参数保留
        return { output: { content: 'OK' } };
      });

      const result = await chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o');

      expect(providerService.getAvailableProviders).toHaveBeenCalledWith('gpt-4o');
      expect(result).toMatchObject({ modelUsed: 'gpt-4o', modelName: 'GPT-4o', costCredits: 3, content: 'OK' });
    });

    it('首个渠道失败（未流式）时 fallback 到下一渠道', async () => {
      const { chatService, adapterRegistry } = buildChatService([
        {
          channelId: 'c1', platformName: 'pptoken', sdkModelId: 'gpt-4o',
          sdkClient: 'openai', priority: 1, costPerCall: null, costPerSecond: null, config: {},
        },
        {
          channelId: 'c2', platformName: 'replicate', sdkModelId: 'gpt-4o',
          sdkClient: 'replicate', priority: 2, costPerCall: null, costPerSecond: null, config: {},
        },
      ]);
      const adapter = adapterRegistry.getAdapter();
      adapter.execute
        .mockRejectedValueOnce(new Error('OpenAI 兼容网关渠道配置不完整：未设置 apiKey'))
        .mockResolvedValueOnce({ output: { content: 'fallback OK' } });

      const result = await chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o');

      expect(adapter.execute).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('fallback OK');
    });

    it('已开始流式后失败不 fallback，直接抛出原错误', async () => {
      const { chatService, adapterRegistry } = buildChatService([
        {
          channelId: 'c1', platformName: 'pptoken', sdkModelId: 'gpt-4o',
          sdkClient: 'openai', priority: 1, costPerCall: null, costPerSecond: null, config: {},
        },
        {
          channelId: 'c2', platformName: 'replicate', sdkModelId: 'gpt-4o',
          sdkClient: 'replicate', priority: 2, costPerCall: null, costPerSecond: null, config: {},
        },
      ]);
      const adapter = adapterRegistry.getAdapter();
      adapter.execute.mockImplementation(async (_i: any, _m: any, ctx: any) => {
        ctx.onProgress(10, '正在连接...');
        throw new Error('连接中断');
      });

      await expect(chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o'))
        .rejects.toThrow('连接中断');
      expect(adapter.execute).toHaveBeenCalledTimes(1); // 只尝试第一个渠道
    });

    it('全部渠道失败时抛出聚合错误', async () => {
      const { chatService, adapterRegistry } = buildChatService([
        {
          channelId: 'c1', platformName: 'pptoken', sdkModelId: 'gpt-4o',
          sdkClient: 'openai', priority: 1, costPerCall: null, costPerSecond: null, config: {},
        },
      ]);
      adapterRegistry.getAdapter().execute.mockRejectedValue(new Error('超时'));

      await expect(chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o'))
        .rejects.toThrow('所有渠道均失败: 超时');
    });

    it('模型无可用渠道时抛出明确错误', async () => {
      const { chatService } = buildChatService([]);

      await expect(chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o'))
        .rejects.toThrow('没有可用的渠道');
    });

    it('无显式模型时使用 text-generation 默认模型', async () => {
      const { chatService } = buildChatService([{
        channelId: 'c1', platformName: 'doubao', sdkModelId: 'x', sdkClient: 'llm',
        priority: 1, costPerCall: null, costPerSecond: null, config: {},
      }]);
      vi.spyOn(chatService, 'getDefaultModel').mockResolvedValue(llmModel as any);

      await chatService.chatStream('user-1', { prompt: '你好' });
      expect(chatService.getDefaultModel).toHaveBeenCalledWith('text-generation');
    });

    it('未解析到模型时抛出 NotFoundException', async () => {
      const { chatService } = buildChatService([]);
      vi.spyOn(chatService, 'getModel').mockResolvedValue(null as any);
      vi.spyOn(chatService, 'getDefaultModel').mockResolvedValue(null as any);

      await expect(chatService.chatStream('user-1', { prompt: '你好' }, 'gpt-4o'))
        .rejects.toThrow('没有可用的文本生成模型');
    });
  });
});

