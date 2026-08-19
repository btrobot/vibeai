/**
 * 视频生成适配器 — 异步任务（SDK 内部轮询）
 *
 * 协议: ASYNC_TASK
 * 使用 VideoGenerationClient.videoGeneration()
 * SDK 内部处理 submit → poll → complete，maxWaitTime 默认 900s
 * returnLastFrame: true 始终开启（用于续编场景）
 */

import { Injectable, Logger } from '@nestjs/common';
import { VideoGenerationClient, Config, type Content } from 'coze-coding-dev-sdk';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

@Injectable()
export class VideoAdapter implements ProtocolAdapter {
  readonly protocolKind = 'ASYNC_TASK' as const;
  readonly modality = 'video' as const;
  readonly sdkClient = 'video';

  private readonly logger = new Logger(VideoAdapter.name);

  /**
   * 按渠道凭证构造 client（对齐 boli GatewayCredentialResolver：凭证来自 DB 平台/渠道配置，
   * env 仅作兜底回退）。
   * 优先级：model.defaultParams.apiKey/baseUrl（ProviderService 合并后的平台/渠道 config）
   *        > env COZE_LOOP_API_TOKEN / COZE_WORKLOAD_API_TOKEN + COZE_LOOP_BASE_URL
   */
  private resolveClient(model: AdapterModel): VideoGenerationClient {
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
        `视频生成渠道配置不完整：未设置 COZE_LOOP_API_TOKEN，且渠道未配置 apiKey，无法调用模型 "${model.sdkModelId}"。请配置渠道密钥后重试`,
      );
    }
    return new VideoGenerationClient(new Config({ apiKey, baseUrl }));
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

    const content = this.buildContent(input, model);

    const options = {
      model: model.sdkModelId,
      duration: (input.duration as number) ?? (model.defaultParams.duration as number) ?? 5,
      ratio: ((input.ratio as string) ?? (model.defaultParams.ratio as string) ?? '16:9') as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive',
      resolution: ((input.resolution as string) ?? (model.defaultParams.resolution as string) ?? '720p') as '480p' | '720p' | '1080p',
      watermark: (input.watermark as boolean) ?? (model.defaultParams.watermark as boolean) ?? true,
      generateAudio: (input.generateAudio as boolean) ?? (model.defaultParams.generateAudio as boolean) ?? true,
      returnLastFrame: true,
      maxWaitTime: (model.defaultParams.maxWaitTime as number) ?? 900,
      ...(input.seed ? { seed: input.seed as number } : {}),
      ...(input.cameraFixed !== undefined ? { camerafixed: input.cameraFixed as boolean } : {}),
    };

    context.onProgress?.(10, '提交生成请求');
    this.logger.log(`Video generation: model=${model.sdkModelId}, taskId=${context.taskId}`);

    let response: Awaited<ReturnType<typeof client.videoGeneration>>;
    try {
      response = await client.videoGeneration(content, options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // SDK 内部 bug: 当 API 返回的 data 不是预期格式时，SDK 直接迭代抛出 "is not iterable"
      // 根因通常是 API token 权限不足或 API 返回了非预期格式
      if (msg.includes('is not iterable') || msg.includes('Cannot read properties')) {
        this.logger.error(`SDK internal error (likely API token/permission issue): ${msg}`);
        throw new Error(
          `视频生成 API 返回了非预期格式的响应。请检查 COZE_LOOP_API_TOKEN 是否具有视频生成权限，或 API 端点是否可达。原始错误: ${msg}`,
        );
      }
      throw err;
    }

    if (!response.videoUrl) {
      throw new Error(response.response.error_message || '视频生成失败');
    }

    context.onProgress?.(100, '视频生成完成');

    return {
      output: {
        video: { url: response.videoUrl },
        lastFrameUrl: response.lastFrameUrl || undefined,
        modelUsed: model.slug,
        seed: response.response.seed,
        duration: response.response.duration,
        resolution: response.response.resolution,
      },
      providerTaskId: response.response.id,
      rawResponse: response,
    };
  }


  /**
   * 构建视频生成的 content 数组
   *
   * 三种互斥场景：
   * 1. Text-to-Video: 仅 text
   * 2. Image-to-Video (first/last frame): image_url with role first_frame/last_frame
   * 3. Multimodal Reference: image_url with role reference_image + video_url + audio_url
   */
  private buildContent(input: Record<string, unknown>, model: AdapterModel): Content[] {
    const content: Content[] = [];
    const prompt = (input.prompt as string) || '';

    const firstFrame = input.firstFrame as string | undefined;
    const lastFrame = input.lastFrame as string | undefined;
    const referenceImages = input.referenceImages as string[] | undefined;
    const referenceVideos = input.referenceVideos as string[] | undefined;
    const referenceAudios = input.referenceAudios as string[] | undefined;

    // 场景 2: Image-to-Video (first/last frame)
    if (firstFrame) {
      content.push({
        type: 'image_url',
        image_url: { url: firstFrame },
        role: 'first_frame',
      });
      if (lastFrame) {
        content.push({
          type: 'image_url',
          image_url: { url: lastFrame },
          role: 'last_frame',
        });
      }
      content.push({ type: 'text', text: prompt });
      return content;
    }

    // 场景 3: Multimodal Reference (Seedance 2.0 only)
    const hasReference = referenceImages?.length || referenceVideos?.length || referenceAudios?.length;
    if (hasReference && model.constraints.supportsMultimodalReference) {
      if (referenceImages?.length) {
        for (const url of referenceImages) {
          content.push({
            type: 'image_url',
            image_url: { url },
            role: 'reference_image',
          });
        }
      }
      if (referenceVideos?.length) {
        for (const url of referenceVideos) {
          content.push({
            type: 'video_url',
            video_url: { url },
            role: 'reference_video',
          });
        }
      }
      if (referenceAudios?.length) {
        for (const url of referenceAudios) {
          content.push({
            type: 'audio_url',
            audio_url: { url },
            role: 'reference_audio',
          });
        }
      }
      content.push({ type: 'text', text: prompt });
      return content;
    }

    // 场景 1: Text-to-Video (默认)
    content.push({ type: 'text', text: prompt });
    return content;
  }
}
