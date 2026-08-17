import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createDrizzleMockForNestJS, type DrizzleMock } from '../../test/drizzle-mock';
import { ModelConfigService } from './model-config.service';

const now = new Date('2026-08-17T00:00:00.000Z');

function modelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
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
    defaultParams: {},
    costCredits: 10,
    tags: [],
    isActive: true,
    isFeatured: false,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function providerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'provider-1',
    modelSlug: 'doubao-seedream-5-0',
    providerName: 'doubao',
    sdkClient: 'image',
    sdkModelId: 'doubao-seedream-5-0-260128',
    priority: 1,
    costPerCall: '0.0300',
    costPerSecond: null,
    config: {},
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ModelConfigService', () => {
  let db: DrizzleMock;
  let service: ModelConfigService;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new ModelConfigService(db as never);
  });

  it('创建逻辑模型并保留数据库返回值', async () => {
    const created = modelRow({ slug: 'new-image-model', name: 'New Image Model' });
    db._resultQueue = [[], [created]];

    await expect(service.createModel({
      slug: 'new-image-model',
      name: 'New Image Model',
      modality: 'image',
      capabilities: ['image-generation'],
      outputType: 'image',
      costCredits: 6,
    })).resolves.toEqual(created);
  });

  it('拒绝重复模型 slug', async () => {
    db._resultQueue = [[modelRow()]];

    await expect(service.createModel({
      slug: 'doubao-seedream-5-0',
      name: 'Duplicate',
      modality: 'image',
      capabilities: ['image-generation'],
      outputType: 'image',
      costCredits: 1,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('更新模型时保持 slug 不变', async () => {
    const updated = modelRow({ name: 'Updated', costCredits: 12 });
    db._resultQueue = [[modelRow()], [updated]];

    await expect(service.updateModel('doubao-seedream-5-0', {
      name: 'Updated',
      costCredits: 12,
    })).resolves.toEqual(updated);

    expect(db.set).toHaveBeenCalledWith(expect.not.objectContaining({ slug: expect.anything() }));
  });

  it('阻止停用能力的唯一有效默认模型', async () => {
    db._resultQueue = [
      [modelRow()],
      [{ capabilitySlug: 'image-generation' }],
      [],
    ];

    await expect(service.setModelStatus('doubao-seedream-5-0', false))
      .rejects.toThrow('请先配置替代默认模型');
  });

  it('为存在的模型创建唯一 Provider', async () => {
    const provider = providerRow();
    db._resultQueue = [[modelRow()], [], [provider]];

    await expect(service.createProvider({
      modelSlug: provider.modelSlug,
      providerName: provider.providerName,
      sdkClient: 'image',
      sdkModelId: provider.sdkModelId,
      priority: 1,
      costPerCall: 0.03,
    })).resolves.toEqual(provider);
  });

  it('拒绝不存在模型的 Provider', async () => {
    db._resultQueue = [[]];

    await expect(service.createProvider({
      modelSlug: 'missing',
      providerName: 'doubao',
      sdkClient: 'image',
      sdkModelId: 'image-v1',
      priority: 1,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('拒绝重复 Provider 组合标识', async () => {
    db._resultQueue = [[modelRow()], [{ id: 'provider-1' }]];

    await expect(service.createProvider({
      modelSlug: 'doubao-seedream-5-0',
      providerName: 'doubao',
      sdkClient: 'image',
      sdkModelId: 'doubao-seedream-5-0-260128',
      priority: 1,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('读取配置时递归移除 Provider 凭证字段', async () => {
    db._resultQueue = [
      [modelRow()],
      [providerRow({ config: { timeout: 30, nested: { apiKey: 'secret', retries: 2 } } })],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.providers[0].config).toEqual({ timeout: 30, nested: { retries: 2 } });
  });

  it('更新 Provider 时转换采购成本并脱敏返回值', async () => {
    const updated = providerRow({
      priority: 2,
      costPerCall: '0.0500',
      config: { region: 'cn', token: 'legacy-secret' },
    });
    db._resultQueue = [[providerRow()], [], [updated]];

    const result = await service.updateProvider('provider-1', {
      priority: 2,
      costPerCall: 0.05,
    });

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ priority: 2, costPerCall: '0.05' }));
    expect(result.config).toEqual({ region: 'cn' });
  });

  it('切换 Provider 状态时脱敏历史配置', async () => {
    const updated = providerRow({ isActive: false, config: { password: 'legacy-secret', timeout: 30 } });
    db._resultQueue = [[providerRow()], [updated]];

    const result = await service.setProviderStatus('provider-1', false);

    expect(result.isActive).toBe(false);
    expect(result.config).toEqual({ timeout: 30 });
  });

  it('事务化替换能力路由并按提交顺序持久化 priority', async () => {
    db._resultQueue = [[
      modelRow(),
      modelRow({ id: 'model-2', slug: 'sdxl', name: 'SDXL' }),
    ]];

    const result = await service.replaceCapabilityRoutes('image-generation', [
      'doubao-seedream-5-0',
      'sdxl',
    ]);

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    expect(db.values).toHaveBeenLastCalledWith([
      expect.objectContaining({ modelSlug: 'doubao-seedream-5-0', priority: 1 }),
      expect.objectContaining({ modelSlug: 'sdxl', priority: 2 }),
    ]);
    expect(result).toEqual([
      expect.objectContaining({ modelSlug: 'doubao-seedream-5-0', priority: 1 }),
      expect.objectContaining({ modelSlug: 'sdxl', priority: 2 }),
    ]);
  });

  it('拒绝空路由和能力不匹配模型', async () => {
    await expect(service.replaceCapabilityRoutes('image-generation', []))
      .rejects.toBeInstanceOf(UnprocessableEntityException);

    db._resultQueue = [[modelRow({ capabilities: ['text-generation'] })]];
    await expect(service.replaceCapabilityRoutes('image-generation', ['doubao-seedream-5-0']))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
