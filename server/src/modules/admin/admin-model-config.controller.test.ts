import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminModelConfigController } from './admin-model-config.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  CreateModelSchema,
  ReplaceCapabilityRoutesSchema,
} from '../gateway/dto/model-config';

describe('AdminModelConfigController', () => {
  const service = {
    getConfiguration: vi.fn(),
    createModel: vi.fn(),
    updateModel: vi.fn(),
    setModelStatus: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    setProviderStatus: vi.fn(),
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
