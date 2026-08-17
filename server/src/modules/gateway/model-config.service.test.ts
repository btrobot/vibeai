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

function platformRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'platform-1',
    name: 'doubao',
    baseUrl: null,
    apiKey: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    apiKeyConfigured: false,
    ...overrides,
  };
}

function channelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'channel-1',
    platformId: 'platform-1',
    modelSlug: 'doubao-seedream-5-0',
    sdkClient: 'image',
    sdkModelId: 'doubao-seedream-5-0-260128',
    priority: 1,
    costPerCall: '0.0300',
    costPerSecond: null,
    config: {},
    apiKeyConfigured: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function configChannelRow(overrides: Record<string, unknown> = {}) {
  return { channel: channelRow(overrides), platformName: 'doubao' };
}

describe('ModelConfigService', () => {
  let db: DrizzleMock;
  let service: ModelConfigService;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new ModelConfigService(db as never);
  });

  // ===== 模型 =====

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

  it('更新模型时合并 defaultParams：保留旧 apiKey，仅覆盖传入字段', async () => {
    const existing = modelRow({ defaultParams: { apiKey: 'sk-old', baseUrl: 'https://old.example.com', watermark: true } });
    const updated = modelRow({ defaultParams: { apiKey: 'sk-old', baseUrl: 'https://new.example.com', watermark: true, size: '2K' } });
    db._resultQueue = [[existing], [updated]];

    await expect(service.updateModel('doubao-seedream-5-0', {
      defaultParams: { baseUrl: 'https://new.example.com', size: '2K' },
    })).resolves.toEqual(updated);

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      defaultParams: { apiKey: 'sk-old', baseUrl: 'https://new.example.com', watermark: true, size: '2K' },
    }));
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

  // ===== 平台 =====

  it('创建平台：name/baseUrl/apiKey 入库，返回脱敏结果', async () => {
    const created = platformRow({
      id: 'platform-pptoken',
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-secret',
      apiKeyConfigured: true,
    });
    db._resultQueue = [[], [created]];

    const result = await service.createPlatform({
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-secret',
    });

    // DB 收到 apiKey 明文
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-secret',
    }));
    // 返回结果脱敏：apiKey 不回显，仅暴露 apiKeyConfigured
    expect(result.apiKeyConfigured).toBe(true);
    expect(result.apiKey).toBeUndefined();
    expect(result.baseUrl).toBe('https://cn.pptoken.cc/v1');
  });

  it('拒绝重复平台名称', async () => {
    db._resultQueue = [[platformRow()]];

    await expect(service.createPlatform({ name: 'doubao' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('更新平台时合并语义：apiKey 留空/不传保留旧值', async () => {
    const existing = platformRow({
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-old',
    });
    const updated = platformRow({
      name: 'pptoken',
      baseUrl: 'https://new.example.com/v1',
      apiKey: 'sk-old',
    });
    db._resultQueue = [[existing], [updated]];

    await service.updatePlatform('platform-1', {
      baseUrl: 'https://new.example.com/v1',
      apiKey: '', // 空串 = 不覆盖
    });

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'https://new.example.com/v1',
    }));
    expect(db.set).not.toHaveBeenCalledWith(expect.objectContaining({ apiKey: expect.anything() }));
  });

  it('更新平台名称时校验唯一性', async () => {
    db._resultQueue = [[platformRow()], [platformRow({ id: 'platform-other', name: 'replicate' })]];

    await expect(service.updatePlatform('platform-1', { name: 'replicate' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('切换平台状态并脱敏返回', async () => {
    const updated = platformRow({ isActive: false });
    db._resultQueue = [[platformRow()], [updated]];

    const result = await service.setPlatformStatus('platform-1', false);

    expect(result.isActive).toBe(false);
    expect(result.apiKey).toBeUndefined();
  });

  it('删除平台（级联删除渠道）', async () => {
    db._resultQueue = [[platformRow()]];

    await expect(service.deletePlatform('platform-1')).resolves.toEqual(platformRow());
    expect(db.delete).toHaveBeenCalled();
  });

  // ===== 渠道 =====

  it('为存在的平台和模型创建唯一渠道', async () => {
    const channel = channelRow();
    db._resultQueue = [[platformRow()], [modelRow()], [], [channel], [platformRow()]];

    await expect(service.createChannel({
      platformId: 'platform-1',
      modelSlug: 'doubao-seedream-5-0',
      sdkClient: 'image',
      sdkModelId: channel.sdkModelId,
      priority: 1,
      costPerCall: 0.03,
    })).resolves.toEqual({ ...channel, platformName: 'doubao' });
  });

  it('创建 openai 渠道：DB 收到含 apiKey 的完整 config，返回脱敏结果', async () => {
    const created = channelRow({
      id: 'channel-pptoken',
      platformId: 'platform-pptoken',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      sdkModelId: 'gpt-image-2',
      priority: 2,
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-test' },
    });
    db._resultQueue = [
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
      [modelRow({ slug: 'gpt-image-2' })],
      [],
      [created],
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
    ];

    const result = await service.createChannel({
      platformId: 'platform-pptoken',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      sdkModelId: 'gpt-image-2',
      priority: 2,
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-test' },
    });

    // DB 存储的 insert 值含 apiKey 明文（存库可运行时替换）
    const inserted = db.values.mock.calls[0][0] as Record<string, any>;
    expect(inserted.config).toEqual({ baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-test' });
    // API 返回值经脱敏，apiKey 不回显
    expect(result.config).toEqual({ baseUrl: 'https://cn.pptoken.cc/v1' });
    expect(result.apiKeyConfigured).toBe(true);
    expect(result.platformName).toBe('pptoken');
  });

  it('拒绝不存在平台的渠道', async () => {
    db._resultQueue = [[]];

    await expect(service.createChannel({
      platformId: 'platform-missing',
      modelSlug: 'doubao-seedream-5-0',
      sdkClient: 'image',
      sdkModelId: 'image-v1',
      priority: 1,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('拒绝不存在模型的渠道', async () => {
    db._resultQueue = [[platformRow()], []];

    await expect(service.createChannel({
      platformId: 'platform-1',
      modelSlug: 'missing',
      sdkClient: 'image',
      sdkModelId: 'image-v1',
      priority: 1,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('拒绝重复渠道组合标识（平台 × 模型 × sdkModelId）', async () => {
    db._resultQueue = [[platformRow()], [modelRow()], [{ id: 'channel-1' }]];

    await expect(service.createChannel({
      platformId: 'platform-1',
      modelSlug: 'doubao-seedream-5-0',
      sdkClient: 'image',
      sdkModelId: 'doubao-seedream-5-0-260128',
      priority: 1,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('更新渠道时转换采购成本并脱敏返回值', async () => {
    const updated = channelRow({
      priority: 2,
      costPerCall: '0.0500',
      config: { region: 'cn', token: 'legacy-secret' },
    });
    db._resultQueue = [[channelRow()], [updated], [platformRow()]];

    const result = await service.updateChannel('channel-1', {
      priority: 2,
      costPerCall: 0.05,
    });

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ priority: 2, costPerCall: '0.05' }));
    expect(result.config).toEqual({ region: 'cn' });
    expect(result.platformName).toBe('doubao');
  });

  it('更新渠道时合并 config：保留旧 apiKey，仅覆盖传入字段', async () => {
    const existing = channelRow({ config: { baseUrl: 'https://old.example.com', apiKey: 'sk-old' } });
    const updated = channelRow({ config: { baseUrl: 'https://new.example.com', apiKey: 'sk-old' } });
    db._resultQueue = [[existing], [updated], [platformRow()]];

    const result = await service.updateChannel('channel-1', {
      config: { baseUrl: 'https://new.example.com' },
    });

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      config: { baseUrl: 'https://new.example.com', apiKey: 'sk-old' },
    }));
    expect(result.apiKeyConfigured).toBe(true);
    expect(result.config).toEqual({ baseUrl: 'https://new.example.com' });
  });

  it('切换渠道状态时脱敏历史配置', async () => {
    const updated = channelRow({ isActive: false, config: { password: 'legacy-secret', timeout: 30 } });
    db._resultQueue = [[channelRow()], [updated]];

    const result = await service.setChannelStatus('channel-1', false);

    expect(result.isActive).toBe(false);
    expect(result.config).toEqual({ timeout: 30 });
  });

  it('删除渠道', async () => {
    db._resultQueue = [[channelRow()]];

    await expect(service.deleteChannel('channel-1')).resolves.toEqual(channelRow());
    expect(db.delete).toHaveBeenCalled();
  });

  it('createChannel 支持 copyFromId：复制源渠道完整 config（含 apiKey）', async () => {
    const source = channelRow({
      id: 'channel-pptoken',
      platformId: 'platform-pptoken',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-copied-secret' },
    });
    db._resultQueue = [
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
      [modelRow({ slug: 'sora-2', name: 'Sora 2' })],
      [],
      [source],
      [channelRow({
        id: 'channel-sora', platformId: 'platform-pptoken', modelSlug: 'sora-2',
        config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-copied-secret' },
      })],
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
    ];

    const result = await service.createChannel({
      platformId: 'platform-pptoken',
      modelSlug: 'sora-2',
      sdkClient: 'openai',
      sdkModelId: 'sora-2',
      priority: 1,
      copyFromId: 'channel-pptoken',
    });

    // DB 收到复制后的完整 config（含 apiKey）
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
      platformId: 'platform-pptoken',
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-copied-secret' },
    }));
    // API 返回脱敏结果
    expect(result.apiKeyConfigured).toBe(true);
    expect(result.config).toEqual({ baseUrl: 'https://cn.pptoken.cc/v1' });
  });

  it('createChannel copyFromId + 显式 config：显式字段覆盖复制值', async () => {
    const source = channelRow({
      id: 'channel-pptoken',
      platformId: 'platform-pptoken',
      sdkClient: 'openai',
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-copied-secret' },
    });
    db._resultQueue = [
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
      [modelRow({ slug: 'sora-2', name: 'Sora 2' })],
      [],
      [source],
      [channelRow({ id: 'channel-sora' })],
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
    ];

    await service.createChannel({
      platformId: 'platform-pptoken',
      modelSlug: 'sora-2',
      sdkClient: 'openai',
      sdkModelId: 'sora-2',
      priority: 1,
      copyFromId: 'channel-pptoken',
      config: { baseUrl: 'https://mirror.example.com/v1' },
    });

    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
      config: { baseUrl: 'https://mirror.example.com/v1', apiKey: 'sk-copied-secret' },
    }));
  });

  it('createChannel copyFromId 指向不存在的渠道时抛 NotFound', async () => {
    db._resultQueue = [
      [platformRow({ id: 'platform-pptoken', name: 'pptoken' })],
      [modelRow({ slug: 'sora-2', name: 'Sora 2' })],
      [],
      [],
    ];

    await expect(service.createChannel({
      platformId: 'platform-pptoken',
      modelSlug: 'sora-2',
      sdkClient: 'openai',
      sdkModelId: 'sora-2',
      priority: 1,
      copyFromId: 'channel-missing',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  // ===== 配置读取 =====

  it('getConfiguration 返回 models/platforms/channels/routes/capabilities', async () => {
    db._resultQueue = [
      [modelRow()],
      [platformRow()],
      [configChannelRow()],
      [],
    ];

    const result = await service.getConfiguration();

    expect(Object.keys(result).sort()).toEqual([
      'capabilities', 'channels', 'models', 'platforms', 'routes',
    ]);
    expect(result.platforms[0].name).toBe('doubao');
    expect(result.channels[0].platformName).toBe('doubao');
  });

  it('读取配置时移除模型 defaultParams 中的凭证字段', async () => {
    db._resultQueue = [
      [modelRow({ defaultParams: { apiKey: 'sk-secret', temperature: 0.7 } })],
      [platformRow()],
      [configChannelRow()],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.models[0].defaultParams).toEqual({ temperature: 0.7 });
  });

  it('读取配置时递归移除渠道 config 凭证字段', async () => {
    db._resultQueue = [
      [modelRow()],
      [platformRow()],
      [configChannelRow({ config: { timeout: 30, nested: { apiKey: 'secret', retries: 2 } } })],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.channels[0].config).toEqual({ timeout: 30, nested: { retries: 2 } });
  });

  it('读取配置时平台 apiKey 不回显', async () => {
    db._resultQueue = [
      [modelRow()],
      [platformRow({ name: 'pptoken', baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-plat-secret' })],
      [configChannelRow()],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.platforms[0].baseUrl).toBe('https://cn.pptoken.cc/v1');
    expect(result.platforms[0].apiKey).toBeUndefined();
    expect(result.platforms[0].apiKeyConfigured).toBe(true);
  });

  it('getConfiguration 返回模型/渠道的 apiKeyConfigured 标记（不泄露 key 明文）', async () => {
    db._resultQueue = [
      [modelRow({ defaultParams: { apiKey: 'sk-model-secret', temperature: 0.7 } })],
      [platformRow()],
      [configChannelRow({ config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-channel-secret' } })],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.models[0].apiKeyConfigured).toBe(true);
    expect(result.models[0].defaultParams).toEqual({ temperature: 0.7 });
    expect(result.channels[0].apiKeyConfigured).toBe(true);
    expect(result.channels[0].config).toEqual({ baseUrl: 'https://cn.pptoken.cc/v1' });
  });

  it('getConfiguration 未配置 key 时 apiKeyConfigured 为 false', async () => {
    db._resultQueue = [
      [modelRow()],
      [platformRow()],
      [configChannelRow()],
      [],
    ];

    const result = await service.getConfiguration();

    expect(result.models[0].apiKeyConfigured).toBe(false);
    expect(result.platforms[0].apiKeyConfigured).toBe(false);
    expect(result.channels[0].apiKeyConfigured).toBe(false);
  });

  // ===== 能力路由 =====

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
