/**
 * ProviderService 单元测试（平台维度）
 *
 * 覆盖范围：
 * - 平台 × 渠道 join 查询返回多渠道列表
 * - config 合并语义：平台 baseUrl/apiKey 默认 + 渠道 config 覆盖
 * - 按优先级排序（由 SQL 保证，此处验证字段透传）
 * - 采购成本数值转换
 * - 无记录时返回空数组
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    db = createDrizzleMockForNestJS();
    service = new ProviderService(db as any);
  });

  describe('getAvailableProviders', () => {
    it('平台 + 渠道有记录时返回多渠道列表（平台默认账号合并进 config）', async () => {
      db._result = [
        channelRow({
          channel: { ...channelRow().channel, priority: 2 },
          platformName: 'replicate',
          platformBaseUrl: null,
          platformApiKey: null,
        }),
        channelRow(),
      ];

      const providers = await service.getAvailableProviders('gpt-image-2');

      expect(providers).toHaveLength(2);
      // 渠道1：replicate 平台无默认账号 → config 不含 baseUrl/apiKey
      expect(providers[0].platformName).toBe('replicate');
      expect(providers[0].config).toEqual({});
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

    it('平台有 baseUrl 但无 apiKey 时仅合并 baseUrl', async () => {
      db._result = [channelRow({ platformApiKey: null })];

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
});
