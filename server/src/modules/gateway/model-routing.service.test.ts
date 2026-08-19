import { describe, expect, it, vi } from 'vitest';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../test/drizzle-mock';
import { ModelRoutingService } from './model-routing.service';
import type { ProviderService } from './provider.service';

function makeModel(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

function makeService(
  db: ReturnType<typeof createDrizzleMockForNestJS>,
  availableProviders: Array<Array<Record<string, unknown>>>,
) {
  const providerService = {
    getAvailableProviders: vi.fn(),
  } as unknown as ProviderService;
  let calls = 0;
  (providerService.getAvailableProviders as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    const result = calls < availableProviders.length ? availableProviders[calls] : [];
    calls += 1;
    return result;
  });
  const service = new ModelRoutingService(providerService, db as never);
  return { service, providerService };
}

describe('ModelRoutingService', () => {
  it('返回首个有可用渠道的启用路由模型及数据库 costCredits', async () => {
    const db = createDrizzleMockForNestJS();
    mockSingle(db, { model: makeModel() });
    const { service } = makeService(db, [[{ channelId: 'c1' }]]);

    await expect(service.getDefaultModel('image-generation')).resolves.toMatchObject({
      slug: 'doubao-seedream-5-0',
      sdkModelId: 'doubao-seedream-5-0-260128',
      costCredits: 10,
    });
  });

  it('没有有效路由时返回 null', async () => {
    const db = createDrizzleMockForNestJS();
    mockEmpty(db);
    const { service } = makeService(db, []);

    await expect(service.getDefaultModel('unknown-capability')).resolves.toBeNull();
  });

  it('首选路由模型没有启用渠道行时跳过该模型（exists 剪枝）', async () => {
    const db = createDrizzleMockForNestJS();
    // 主查询返回第二条路由模型（第一条无渠道行被 exists 子查询过滤）
    mockSingle(db, { model: makeModel({ slug: 'doubao-seedream-4-5', costCredits: 8, sortOrder: 20 }) });
    const { service } = makeService(db, [[{ channelId: 'c2' }]]);

    await expect(service.getDefaultModel('image-generation')).resolves.toMatchObject({
      slug: 'doubao-seedream-4-5',
      costCredits: 8,
    });
  });

  it('渠道行存在但凭证不完整的模型被跳过，落到下一个有可用渠道的模型（对齐 boli 凭证解析）', async () => {
    const db = createDrizzleMockForNestJS();
    mockMany(db, [
      { model: makeModel() }, // priority 1：doubao-seedream-5-0，渠道凭证不完整 → 跳过
      { model: makeModel({ id: 'model-2', slug: 'gpt-image-2', costCredits: 12, sortOrder: 30 }) },
    ]);
    const { service, providerService } = makeService(db, [
      [], // 第一个候选模型无可用渠道（凭证不完整被过滤）
      [{ channelId: 'c-pptoken' }], // 第二个候选模型有可用渠道（pptoken/openai）
    ]);

    await expect(service.getDefaultModel('background-removal')).resolves.toMatchObject({
      slug: 'gpt-image-2',
      costCredits: 12,
    });
    expect(providerService.getAvailableProviders).toHaveBeenCalledWith('doubao-seedream-5-0');
    expect(providerService.getAvailableProviders).toHaveBeenCalledWith('gpt-image-2');
  });

  it('所有候选模型均无可用渠道（凭证不完整）时返回 null，不再报错', async () => {
    const db = createDrizzleMockForNestJS();
    mockMany(db, [
      { model: makeModel() },
      { model: makeModel({ id: 'model-2', slug: 'gpt-image-2', sortOrder: 30 }) },
    ]);
    const { service } = makeService(db, [[], []]);

    await expect(service.getDefaultModel('background-removal')).resolves.toBeNull();
  });

  it('查询异常时抛出 ServiceUnavailableException（不返回内存模型）', async () => {
    const db = createDrizzleMockForNestJS();
    db.select.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    const { service } = makeService(db, []);

    await expect(service.getDefaultModel('image-generation')).rejects.toThrow('模型路由配置暂时不可用');
  });
});
