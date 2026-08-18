import { describe, expect, it } from 'vitest';
import { createDrizzleMockForNestJS, mockSingle } from '../../test/drizzle-mock';
import { ModelRoutingService } from './model-routing.service';

describe('ModelRoutingService', () => {
  it('返回首个启用路由模型及数据库 costCredits', async () => {
    const db = createDrizzleMockForNestJS();
    mockSingle(db, {
      model: {
        id: 'model-1',
        slug: 'doubao-seedream-5-0',
        name: 'Doubao Seedream 5.0',
        providerName: 'doubao',
        modality: 'image',
        sdkModelId: 'doubao-seedream-5-0-260128',
        sdkClient: 'image',
        capabilities: ['image-generation'],
        description: '图片生成模型',
        avatar: null,
        contextWindow: null,
        maxOutputTokens: null,
        inputModes: ['text'],
        outputType: 'image',
        constraints: {},
        inputSchema: {},
        defaultParams: { size: '2K' },
        costCredits: 10,
        tags: ['featured'],
        isActive: true,
        isFeatured: true,
        sortOrder: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const service = new ModelRoutingService(db as never);

    await expect(service.getDefaultModel('image-generation')).resolves.toMatchObject({
      slug: 'doubao-seedream-5-0',
      sdkModelId: 'doubao-seedream-5-0-260128',
      costCredits: 10,
    });
  });

  it('没有有效路由时返回 null', async () => {
    const db = createDrizzleMockForNestJS();
    const service = new ModelRoutingService(db as never);

    await expect(service.getDefaultModel('unknown-capability')).resolves.toBeNull();
  });
  it('无有效路由时返回 null', async () => {
    const db = createDrizzleMockForNestJS();
    const service = new ModelRoutingService(db as never);

    await expect(service.getDefaultModel('unknown-capability')).resolves.toBeNull();
  });

  it('首选路由模型没有启用渠道时跳过该模型（路由级 fallback）', async () => {
    const db = createDrizzleMockForNestJS();
    // 主查询返回第二条路由模型（第一条无渠道被 exists 子查询过滤）
    mockSingle(db, {
      model: {
        id: 'model-2',
        slug: 'doubao-seedream-4-5',
        name: 'Doubao Seedream 4.5',
        providerName: 'doubao',
        modality: 'image',
        sdkModelId: 'doubao-seedream-4-5-251128',
        sdkClient: 'image',
        capabilities: ['image-generation'],
        description: null,
        avatar: null,
        contextWindow: null,
        maxOutputTokens: null,
        inputModes: ['text'],
        outputType: 'image',
        constraints: {},
        inputSchema: {},
        defaultParams: {},
        costCredits: 8,
        tags: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const service2 = new ModelRoutingService(db as never);
    await expect(service2.getDefaultModel('image-generation')).resolves.toMatchObject({
      slug: 'doubao-seedream-4-5',
      costCredits: 8,
    });
  });

  it('查询异常时抛出 ServiceUnavailableException（不返回内存模型）', async () => {
    const db = createDrizzleMockForNestJS();
    db.select.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    const service = new ModelRoutingService(db as never);

    await expect(service.getDefaultModel('image-generation')).rejects.toThrow('模型路由配置暂时不可用');
  });
});

