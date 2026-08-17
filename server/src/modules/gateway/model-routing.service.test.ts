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
});
