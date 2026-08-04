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

  private readonly logger = new Logger(VideoAdapter.name);
  private client: VideoGenerationClient | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      const apiKey = process.env.COZE_LOOP_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN || '';
      const baseUrl = process.env.COZE_LOOP_BASE_URL || 'https://api.coze.cn';

      if (!apiKey) {
        this.logger.warn('COZE_LOOP_API_TOKEN not set, Video adapter running in MOCK mode');
        return;
      }

      const config = new Config({ apiKey, baseUrl });
      this.client = new VideoGenerationClient(config);
      this.logger.log('Video generation client initialized');
    } catch (e) {
      this.logger.error('Failed to initialize video client', e);
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
      this.logger.warn(`[MOCK] Video generation: model=${model.sdkModelId}, prompt="${prompt.substring(0, 50)}", taskId=${context.taskId}`);
      context.onProgress?.(10, '[Mock] 提交生成请求');
      await this.delay(500);
      context.onProgress?.(50, '[Mock] 视频渲染中...');
      await this.delay(800);
      context.onProgress?.(100, '[Mock] 视频生成完成');

      return {
        output: {
          video: { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4' },
          modelUsed: model.slug,
          mock: true,
          duration: (input.duration as number) ?? 5,
          resolution: (input.resolution as string) ?? '720p',
        },
        providerTaskId: 'mock-' + Date.now(),
      };
    }

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

    const response = await this.client.videoGeneration(content, options);

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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
