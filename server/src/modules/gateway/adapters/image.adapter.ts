/**
 * 图片生成适配器 — 同步请求-响应
 *
 * 协议: SYNC_REQUEST_RESPONSE
 * 使用 ImageGenerationClient.generate()
 * 参数从 model.constraints + model.defaultParams + input 合并
 */

import { Injectable, Logger } from '@nestjs/common';
import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

@Injectable()
export class ImageAdapter implements ProtocolAdapter {
  readonly protocolKind = 'SYNC_REQUEST_RESPONSE' as const;
  readonly modality = 'image' as const;

  private readonly logger = new Logger(ImageAdapter.name);
  private client: ImageGenerationClient | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      const apiKey = process.env.COZE_LOOP_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN || '';
      const baseUrl = process.env.COZE_LOOP_BASE_URL || 'https://api.coze.cn';

      if (!apiKey) {
        this.logger.warn('COZE_LOOP_API_TOKEN not set, Image adapter running in MOCK mode');
        return;
      }

      const config = new Config({ apiKey, baseUrl });
      this.client = new ImageGenerationClient(config);
      this.logger.log('Image generation client initialized');
    } catch (e) {
      this.logger.error('Failed to initialize image client', e);
    }
  }

  async execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const prompt = (input.prompt as string) || '';

    // Mock mode: no API token configured
    if (!this.client) {
      this.logger.warn(`[MOCK] Image generation: model=${model.sdkModelId}, prompt="${prompt.substring(0, 50)}", taskId=${context.taskId}`);
      context.onProgress?.(50, '[Mock] 生成中...');
      await this.delay(800);
      context.onProgress?.(100, '[Mock] 生成完成');

      return {
        output: {
          images: [{ url: 'https://picsum.photos/seed/' + encodeURIComponent(prompt.substring(0, 20)) + '/1024/1024' }],
          modelUsed: model.slug,
          mock: true,
        },
      };
    }

    const size = (input.size as string) ?? (model.defaultParams.size as string) ?? '2K';
    const watermark = (input.watermark as boolean) ?? (model.defaultParams.watermark as boolean) ?? true;
    const referenceImages = input.referenceImages as string[] | undefined;
    const referenceImage = input.referenceImage as string | undefined;

    // 合并参考图片
    const imageInput = referenceImages ?? (referenceImage ? [referenceImage] : undefined);

    this.logger.log(`Image generation: model=${model.sdkModelId}, size=${size}, taskId=${context.taskId}`);

    const response = await this.client.generate({
      prompt,
      model: model.sdkModelId,
      size,
      watermark,
      ...(imageInput ? { image: imageInput.length === 1 ? imageInput[0] : imageInput } : {}),
    });

    const helper = this.client.getResponseHelper(response);
    if (!helper.success) {
      throw new Error(helper.errorMessages.join('; ') || '图片生成失败');
    }

    context.onProgress?.(100, `生成 ${helper.imageUrls.length} 张图片`);

    return {
      output: {
        images: helper.imageUrls.map((url) => ({ url })),
        modelUsed: model.slug,
      },
      rawResponse: response,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
