/**
 * 图片生成适配器 — 同步请求-响应
 *
 * 协议: SYNC_REQUEST_RESPONSE
 * 使用 ImageGenerationClient.generate()
 * 参数从 model.constraints + model.defaultParams + input 合并
 * 生产模式：未配置 COZE_LOOP_API_TOKEN 时抛错，不再 Mock
 */

import { Injectable, Logger } from '@nestjs/common';
import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

@Injectable()
export class ImageAdapter implements ProtocolAdapter {
  readonly protocolKind = 'SYNC_REQUEST_RESPONSE' as const;
  readonly modality = 'image' as const;
  readonly sdkClient = 'image';

  private readonly logger = new Logger(ImageAdapter.name);

  /**
   * 按渠道凭证构造 client（对齐 boli GatewayCredentialResolver：凭证来自 DB 平台/渠道配置，
   * env 仅作兜底回退）。
   * 优先级：model.defaultParams.apiKey/baseUrl（ProviderService 合并后的平台/渠道 config）
   *        > env COZE_LOOP_API_TOKEN / COZE_WORKLOAD_API_TOKEN + COZE_LOOP_BASE_URL
   */
  private resolveClient(model: AdapterModel): ImageGenerationClient {
    const apiKey =
      (model.defaultParams?.apiKey as string) ||
      process.env.COZE_LOOP_API_TOKEN ||
      process.env.COZE_WORKLOAD_API_TOKEN ||
      '';
    const baseUrl =
      (model.defaultParams?.baseUrl as string) ||
      process.env.COZE_LOOP_BASE_URL ||
      'https://api.coze.cn';

    if (!apiKey) {
      throw new Error(
        `图片生成渠道配置不完整：未设置 COZE_LOOP_API_TOKEN，且渠道未配置 apiKey，无法调用模型 "${model.sdkModelId}"。请配置渠道密钥后重试`,
      );
    }
    return new ImageGenerationClient(new Config({ apiKey, baseUrl }));
  }

  async execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const prompt = (input.prompt as string) || '';

    // 生产模式：渠道必须配置完整，未配置密钥直接报错（不再 Mock）
    // 凭证解析：渠道/平台 config（defaultParams.apiKey/baseUrl）> env 兜底
    const client = this.resolveClient(model);

    const size = (input.size as string) ?? (model.defaultParams.size as string) ?? '2K';
    const watermark = (input.watermark as boolean) ?? (model.defaultParams.watermark as boolean) ?? true;
    const referenceImages = input.referenceImages as string[] | undefined;
    const referenceImage = input.referenceImage as string | undefined;

    // 合并参考图片
    const imageInput = referenceImages?.length ? referenceImages : referenceImage ? [referenceImage] : undefined;

    this.logger.log(`Image generation: model=${model.sdkModelId}, size=${size}, taskId=${context.taskId}`);

    let response: Awaited<ReturnType<typeof client.generate>>;
    try {
      response = await client.generate({
        prompt,
        model: model.sdkModelId,
        size,
        watermark,
        ...(imageInput ? { image: imageInput.length === 1 ? imageInput[0] : imageInput } : {}),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // SDK 内部 bug: 当 API 返回的 data 不是数组时，SDK 直接 for...of 抛出 "is not iterable"
      // 根因通常是 API token 权限不足或 API 返回了非预期格式
      if (msg.includes('is not iterable') || msg.includes('Cannot read properties')) {
        this.logger.error(`SDK internal error (likely API token/permission issue): ${msg}`);
        throw new Error(
          `图片生成 API 返回了非预期格式的响应。请检查 COZE_LOOP_API_TOKEN 是否具有图片生成权限，或 API 端点是否可达。原始错误: ${msg}`,
        );
      }
      throw err;
    }

    const helper = client.getResponseHelper(response);
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

}
