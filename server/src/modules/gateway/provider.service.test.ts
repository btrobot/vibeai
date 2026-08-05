/**
 * ProviderService 单元测试
 *
 * 覆盖范围：
 * - 多 provider 查询（modelProviders 表有记录）
 * - 回退到 fallback（modelProviders 表无记录）
 * - 按优先级排序
 * - costPerCall 数值转换
 * - config 为 null 时返回空对象
 * - 无 fallback 且无 DB 记录时返回空数组
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderService } from './provider.service';
import { createDrizzleMockForNestJS } from '../../test/drizzle-mock';

describe('ProviderService', () => {
  let service: ProviderService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDrizzleMockForNestJS();
    service = new ProviderService(db as any);
  });

  describe('getAvailableProviders', () => {
    it('modelProviders 表有记录时应返回多渠道列表', async () => {
      db._result = [
        { modelSlug: 'gpt-image-2', providerName: 'replicate', sdkModelId: 'openai/gpt-image-2:abc', sdkClient: 'replicate', priority: 1, costPerCall: '0.05', config: { width: 1024 }, isActive: true },
        { modelSlug: 'gpt-image-2', providerName: 'coze', sdkModelId: 'doubao-seedream-5-0-260128', sdkClient: 'image', priority: 2, costPerCall: null, config: {}, isActive: true },
      ];

      const providers = await service.getAvailableProviders('gpt-image-2', {
        providerName: 'replicate',
        sdkModelId: 'openai/gpt-image-2:placeholder',
        sdkClient: 'replicate',
      });

      expect(providers).toHaveLength(2);
      expect(providers[0].providerName).toBe('replicate');
      expect(providers[0].priority).toBe(1);
      expect(providers[0].costPerCall).toBe(0.05);
      expect(providers[0].config).toEqual({ width: 1024 });
      expect(providers[1].providerName).toBe('coze');
    });

    it('modelProviders 表无记录时应回退到 fallback', async () => {
      db._result = [];

      const providers = await service.getAvailableProviders('doubao-seedream-5-0', {
        providerName: 'doubao',
        sdkModelId: 'doubao-seedream-5-0-260128',
        sdkClient: 'image',
      });

      expect(providers).toHaveLength(1);
      expect(providers[0].providerName).toBe('doubao');
      expect(providers[0].sdkModelId).toBe('doubao-seedream-5-0-260128');
      expect(providers[0].sdkClient).toBe('image');
      expect(providers[0].priority).toBe(0);
      expect(providers[0].costPerCall).toBeNull();
    });

    it('costPerCall 字符串应正确转换为数字', async () => {
      db._result = [
        { modelSlug: 'sdxl', providerName: 'replicate', sdkModelId: 'stability-ai/sdxl:def', sdkClient: 'replicate', priority: 1, costPerCall: '0.002', config: {}, isActive: true },
      ];

      const providers = await service.getAvailableProviders('sdxl', {
        providerName: 'replicate',
        sdkModelId: 'stability-ai/sdxl:placeholder',
        sdkClient: 'replicate',
      });

      expect(providers[0].costPerCall).toBe(0.002);
    });

    it('costPerCall 为 null 时应保持 null', async () => {
      db._result = [
        { modelSlug: 'sdxl', providerName: 'replicate', sdkModelId: 'stability-ai/sdxl:def', sdkClient: 'replicate', priority: 1, costPerCall: null, config: {}, isActive: true },
      ];

      const providers = await service.getAvailableProviders('sdxl', {
        providerName: 'replicate',
        sdkModelId: 'stability-ai/sdxl:placeholder',
        sdkClient: 'replicate',
      });

      expect(providers[0].costPerCall).toBeNull();
    });

    it('config 为 null 时应返回空对象', async () => {
      db._result = [
        { modelSlug: 'sdxl', providerName: 'replicate', sdkModelId: 'stability-ai/sdxl:def', sdkClient: 'replicate', priority: 1, costPerCall: null, config: null, isActive: true },
      ];

      const providers = await service.getAvailableProviders('sdxl', {
        providerName: 'replicate',
        sdkModelId: 'stability-ai/sdxl:placeholder',
        sdkClient: 'replicate',
      });

      expect(providers[0].config).toEqual({});
    });

    it('无 fallback 且 DB 无记录时应返回空数组', async () => {
      db._result = [];

      const providers = await service.getAvailableProviders('unknown-model');

      expect(providers).toHaveLength(0);
    });

    it('返回的 provider 应包含所有必需字段', async () => {
      db._result = [
        { modelSlug: 'flux-schnell', providerName: 'replicate', sdkModelId: 'blackforestlabs/flux-schnell:ghi', sdkClient: 'replicate', priority: 1, costPerCall: '0.003', config: { num_outputs: 1 }, isActive: true },
      ];

      const providers = await service.getAvailableProviders('flux-schnell', {
        providerName: 'replicate',
        sdkModelId: 'blackforestlabs/flux-schnell:placeholder',
        sdkClient: 'replicate',
      });

      expect(providers[0]).toEqual({
        providerName: 'replicate',
        sdkModelId: 'blackforestlabs/flux-schnell:ghi',
        sdkClient: 'replicate',
        priority: 1,
        costPerCall: 0.003,
        config: { num_outputs: 1 },
      });
    });

    it('单 provider 回退时应设置 priority=0', async () => {
      db._result = [];

      const providers = await service.getAvailableProviders('doubao-seed-2-0-pro', {
        providerName: 'doubao',
        sdkModelId: 'doubao-seed-2-0-pro-260215',
        sdkClient: 'llm',
      });

      expect(providers).toHaveLength(1);
      expect(providers[0].priority).toBe(0);
    });
  });
});
