import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminModelConfigController } from './admin-model-config.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  CreateChannelSchema,
  CreateModelSchema,
  CreatePlatformSchema,
  ReplaceCapabilityRoutesSchema,
} from '../gateway/dto/model-config';

describe('AdminModelConfigController', () => {
  const service = {
    getConfiguration: vi.fn(),
    createModel: vi.fn(),
    updateModel: vi.fn(),
    setModelStatus: vi.fn(),
    createPlatform: vi.fn(),
    updatePlatform: vi.fn(),
    setPlatformStatus: vi.fn(),
    deletePlatform: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    setChannelStatus: vi.fn(),
    deleteChannel: vi.fn(),
    replaceCapabilityRoutes: vi.fn(),
  };
  let controller: AdminModelConfigController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminModelConfigController(service as never);
  });

  it('委托有效模型创建并统一包装响应', async () => {
    const body = {
      slug: 'new-image-model',
      name: 'New Image Model',
      modality: 'image' as const,
      capabilities: ['image-generation'],
      outputType: 'image',
      costCredits: 3,
    };
    service.createModel.mockResolvedValue({ id: 'model-1', ...body });

    await expect(controller.createModel(body)).resolves.toEqual({
      success: true,
      data: { id: 'model-1', ...body },
    });
  });

  it('拒绝负数模型成本', () => {
    const pipe = new ZodValidationPipe(CreateModelSchema);

    expect(() => pipe.transform({
      slug: 'bad-model',
      name: 'Bad Model',
      modality: 'image',
      capabilities: ['image-generation'],
      outputType: 'image',
      costCredits: -1,
    })).toThrow(BadRequestException);
  });

  it('接受 openai 渠道并放行 baseUrl/apiKey 配置', () => {
    const pipe = new ZodValidationPipe(CreateChannelSchema);

    expect(() => pipe.transform({
      platformId: '11111111-1111-1111-1111-111111111111',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      sdkModelId: 'gpt-image-2',
      priority: 2,
      config: { baseUrl: 'https://cn.pptoken.cc/v1', apiKey: 'sk-test' },
    })).not.toThrow();
  });

  it('拒绝包含 password/token 的渠道配置', () => {
    const pipe = new ZodValidationPipe(CreateChannelSchema);

    expect(() => pipe.transform({
      platformId: '11111111-1111-1111-1111-111111111111',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai',
      sdkModelId: 'gpt-image-2',
      priority: 2,
      config: { baseUrl: 'https://cn.pptoken.cc/v1', password: 'hunter2' },
    })).toThrow(BadRequestException);
  });

  it('接受创建平台（name + baseUrl + apiKey）', () => {
    const pipe = new ZodValidationPipe(CreatePlatformSchema);

    expect(() => pipe.transform({
      name: 'pptoken',
      baseUrl: 'https://cn.pptoken.cc/v1',
      apiKey: 'sk-test',
    })).not.toThrow();
  });

  it('拒绝缺少名称的平台', () => {
    const pipe = new ZodValidationPipe(CreatePlatformSchema);

    expect(() => pipe.transform({ baseUrl: 'https://cn.pptoken.cc/v1' }))
      .toThrow(BadRequestException);
  });

  it('委托创建渠道并统一包装响应', async () => {
    const body = {
      platformId: '11111111-1111-1111-1111-111111111111',
      modelSlug: 'gpt-image-2',
      sdkClient: 'openai' as const,
      sdkModelId: 'gpt-image-2',
      priority: 2,
    };
    service.createChannel.mockResolvedValue({ id: 'channel-1', platformName: 'pptoken', ...body });

    await expect(controller.createChannel(body)).resolves.toEqual({
      success: true,
      data: { id: 'channel-1', platformName: 'pptoken', ...body },
    });
    expect(service.createChannel).toHaveBeenCalledWith(body);
  });

  it('委托创建平台并统一包装响应', async () => {
    const body = { name: 'pptoken', baseUrl: 'https://cn.pptoken.cc/v1' };
    service.createPlatform.mockResolvedValue({ id: 'platform-1', apiKeyConfigured: false, ...body });

    await expect(controller.createPlatform(body)).resolves.toEqual({
      success: true,
      data: { id: 'platform-1', apiKeyConfigured: false, ...body },
    });
    expect(service.createPlatform).toHaveBeenCalledWith(body);
  });

  it('拒绝空路由列表', () => {
    const pipe = new ZodValidationPipe(ReplaceCapabilityRoutesSchema);

    expect(() => pipe.transform({ modelSlugs: [] })).toThrow(BadRequestException);
  });

  it('委托完整有序路由替换并统一包装响应', async () => {
    const body = { modelSlugs: ['doubao-seedream-5-0', 'sdxl'] };
    service.replaceCapabilityRoutes.mockResolvedValue(body.modelSlugs);

    await expect(controller.replaceCapabilityRoutes('image-generation', body)).resolves.toEqual({
      success: true,
      data: body.modelSlugs,
    });
    expect(service.replaceCapabilityRoutes).toHaveBeenCalledWith(
      'image-generation',
      body.modelSlugs,
    );
  });
});
