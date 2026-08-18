/**
 * ProviderService 单元测试（平台维度）
 *
 * 覆盖范围：
 * - 平台 × 渠道 join 查询返回多渠道列表
 * - config 合并语义：平台 baseUrl/apiKey 默认 + 渠道 config 覆盖
 * - 按优先级排序（由 SQL 保证，此处验证字段透传）
 * - 采购成本数值转换
 * - 无记录时返回空数组
 * - 渠道参数完整性过滤（GTW-024）：openai 需 apiKey；replicate/coze 协议需进程环境 token
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderService } from './provider.service';
import { createDrizzleMockForNestJS } from '../../test/drizzle-mock';

function channelRow(overrides: Record<string, unknown> = {}) {
  return {
    channel: {
      id: 'ch-1',
      platformId: 'plat-1',
      modelSlug: 'gpt-image-2',
      sdkModelId: 'openai/gpt-image-2',
      sdkClient: 'openai',
      priority: 1,
      costPerCall: '0.05',
      costPerSecond: '0.004',
      config: {} as Record<string, unknown>,
      isActive: true,
    },
    platformName: 'pptoken',
    platformBaseUrl: 'https://cn.pptoken.cc/v1',
    platformApiKey: 'plat-key-1',
    ...overrides,
  };
}

describe('ProviderService', () => {
  let service: ProviderService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    db = createDrizzleMockForNestJS();
    service = new ProviderService(db as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getAvailableProviders', () => {
    it('平台 + 渠道有记录时返回多渠道列表（平台默认账号合并进 config）', async () => {
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            priority: 2,
            // openai 协议渠道必须有 apiKey 才有效（GTW-024）；无平台默认时由渠道 config 提供
            config: { apiKey: 'ch-key-replicate' },
          },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
        channelRow(),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toHaveLength(2);
      // 渠道1：replicate 平台无默认账号 → 仅合并渠道 config 的 apiKey
      expect(providers[0].platformName).toBe('replicate');
      expect(providers[0].config).toEqual({ apiKey: 'ch-key-replicate' });
      // 渠道2：pptoken 平台有默认账号 → config 合并平台 baseUrl/apiKey
      expect(providers[1].platformName).toBe('pptoken');
      expect(providers[1].config).toEqual({
        baseUrl: 'https://cn.pptoken.cc/v1',
        apiKey: 'plat-key-1',
      });
      expect(providers[1].costPerCall).toBe(0.05);
      expect(providers[1].costPerSecond).toBe(0.004);
    });

    it('渠道 config 覆盖平台默认账号', async () => {
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            config: { baseUrl: 'https://channel.example/v1', apiKey: 'channel-key' },
          },
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers[0].config).toEqual({
        baseUrl: 'https://channel.example/v1',
        apiKey: 'channel-key',
      });
    });

    it('平台有 baseUrl 但无 apiKey 时仅合并 baseUrl（未知协议不过滤，仅验证合并语义）', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, sdkClient: 'future-protocol' },
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers[0].config).toEqual({ baseUrl: 'https://cn.pptoken.cc/v1' });
    });

    it('无启用渠道时返回空列表', async () => {
      db._result = [];

      const providers = await service.getAvailableProviders('doubao-seedream-5-0');

      expect(providers).toEqual([]);
    });

    it('costPerCall 字符串应正确转换为数字', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, modelSlug: 'sdxl', costPerCall: '0.002' },
        }),
      ];

      const providers = await service.getAvailableProviders('sdxl');

      expect(providers[0].costPerCall).toBe(0.002);
    });

    it('costPerCall 为 null 时应保持 null', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, modelSlug: 'sdxl', costPerCall: null, costPerSecond: null },
        }),
      ];

      const providers = await service.getAvailableProviders('sdxl');

      expect(providers[0].costPerCall).toBeNull();
      expect(providers[0].costPerSecond).toBeNull();
    });

    it('渠道 config 为 null 时应仅返回平台默认', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, modelSlug: 'sdxl', config: null },
        }),
      ];

      const providers = await service.getAvailableProviders('sdxl');

      expect(providers[0].config).toEqual({
        baseUrl: 'https://cn.pptoken.cc/v1',
        apiKey: 'plat-key-1',
      });
    });

    it('未知模型且 DB 无记录时应返回空数组', async () => {
      db._result = [];

      const providers = await service.getAvailableProviders('unknown-model');

      expect(providers).toHaveLength(0);
    });

    it('返回的 provider 应包含所有必需字段', async () => {
      vi.stubEnv('REPLICATE_API_TOKEN', 'test-token');
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            modelSlug: 'flux-schnell',
            sdkModelId: 'blackforestlabs/flux-schnell:ghi',
            sdkClient: 'replicate',
            priority: 3,
            costPerCall: '0.003',
            costPerSecond: '0.001',
            config: { num_outputs: 1 },
          },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('flux-schnell');

      expect(providers[0]).toEqual({
        channelId: 'ch-1',
        platformId: 'plat-1',
        platformName: 'replicate',
        sdkModelId: 'blackforestlabs/flux-schnell:ghi',
        sdkClient: 'replicate',
        priority: 3,
        costPerCall: 0.003,
        costPerSecond: 0.001,
        config: { num_outputs: 1 },
      });
    });
  });

  describe('渠道参数完整性过滤（GTW-024）', () => {
    it('openai 渠道平台与渠道均无 apiKey 时被过滤（返回空）', async () => {
      db._result = [channelRow({ platformApiKey: null })];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toEqual([]);
    });

    it('openai 渠道 apiKey 为空白字符串时被过滤', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, config: { apiKey: '   ' } },
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toEqual([]);
    });

    it('openai 渠道 apiKey 仅存于渠道 config 时保留', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, config: { apiKey: 'ch-only-key' } },
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toHaveLength(1);
      expect(providers[0].config.apiKey).toBe('ch-only-key');
    });

    it('replicate 渠道进程环境无 REPLICATE_API_TOKEN 时被过滤', async () => {
      vi.stubEnv('REPLICATE_API_TOKEN', '');
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            modelSlug: 'flux-schnell',
            sdkClient: 'replicate',
            config: { num_outputs: 1 },
          },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('flux-schnell');

      expect(providers).toEqual([]);
    });

    it('replicate 渠道进程环境有 REPLICATE_API_TOKEN 时保留', async () => {
      vi.stubEnv('REPLICATE_API_TOKEN', 'test-token');
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            modelSlug: 'flux-schnell',
            sdkClient: 'replicate',
            config: { num_outputs: 1 },
          },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('flux-schnell');

      expect(providers).toHaveLength(1);
    });

    it('coze 协议渠道（image/llm/video）进程环境无 token 时被过滤', async () => {
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            modelSlug: 'doubao-seedream-5-0',
            sdkClient: 'image',
            config: null,
          },
          platformName: 'coze',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('doubao-seedream-5-0');

      expect(providers).toEqual([]);
    });

    it('coze 协议渠道进程环境有 COZE_LOOP_API_TOKEN 时保留', async () => {
      vi.stubEnv('COZE_LOOP_API_TOKEN', 'test-token');
      db._result = [
        channelRow({
          channel: {
            ...channelRow().channel,
            modelSlug: 'doubao-seedream-5-0',
            sdkClient: 'image',
            config: null,
          },
          platformName: 'coze',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('doubao-seedream-5-0');

      expect(providers).toHaveLength(1);
    });

    it('未知 sdkClient 不过滤（保留由适配器自身校验）', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, sdkClient: 'future-protocol' },
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toHaveLength(1);
    });

    it('多渠道时仅返回参数完整的渠道（不完整渠道被过滤且不影响其余渠道）', async () => {
      db._result = [
        // replicate 渠道：env 无 token → 过滤
        channelRow({
          channel: {
            ...channelRow().channel,
            priority: 1,
            sdkClient: 'replicate',
            config: { num_outputs: 1 },
          },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
        // openai 渠道：无 apiKey → 过滤
        channelRow({
          channel: { ...channelRow().channel, priority: 2 },
          platformApiKey: null,
        }),
        // openai 渠道：有 apiKey → 保留
        channelRow({
          channel: { ...channelRow().channel, priority: 3, config: { apiKey: 'valid-key' } },
          platformApiKey: null,
        }),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toHaveLength(1);
      expect(providers[0].priority).toBe(3);
      expect(providers[0].config.apiKey).toBe('valid-key');
    });
  });
});
