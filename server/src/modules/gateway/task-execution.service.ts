import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { generationTasks, tasks } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { LLMClient, ImageGenerationClient, VideoGenerationClient, Config } from 'coze-coding-dev-sdk';
import { WsService } from '../ws/ws.service';
import type { LLMConfig } from 'coze-coding-dev-sdk';

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);
  private llmClient!: LLMClient;
  private imageClient!: ImageGenerationClient;
  private videoClient!: VideoGenerationClient;
  private initialized = false;

  constructor(
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
    private wsService: WsService,
  ) {
    this.initClients();
  }

  private initClients() {
    try {
      const apiKey = process.env.COZE_LOOP_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN || '';
      const baseUrl = process.env.COZE_LOOP_BASE_URL || 'https://api.coze.cn';

      if (!apiKey) {
        this.logger.warn('COZE_LOOP_API_TOKEN not set, AI execution will be disabled');
        return;
      }

      const config = new Config({ apiKey, baseUrl });
      this.llmClient = new LLMClient(config);
      this.imageClient = new ImageGenerationClient(config);
      this.videoClient = new VideoGenerationClient(config);
      this.initialized = true;
      this.logger.log('AI SDK clients initialized successfully');
    } catch (e) {
      this.logger.error('Failed to initialize AI SDK clients', e);
    }
  }

  async executeTask(
    taskId: string,
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    if (!this.initialized) {
      this.logger.warn(`AI not initialized, skipping execution for task ${taskId}`);
      await this.db.update(generationTasks)
        .set({
          status: 'failed',
          errorMessage: 'AI 服务未初始化，请检查 COZE_LOOP_API_TOKEN 配置',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationTasks.id, taskId));

      this.wsService.sendToUser(userId, {
        type: 'task:status',
        payload: { taskId, status: 'failed', error: 'AI 服务未初始化' },
      });
      return;
    }

    // Notify frontend that task is running
    await this.db.update(generationTasks)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(generationTasks.id, taskId));

    this.wsService.sendToUser(userId, {
      type: 'task:status',
      payload: { taskId, status: 'running' },
    });

    try {
      let output: Record<string, unknown> = {};

      switch (capabilitySlug) {
        case 'text-generation':
        case 'chat':
        case 'code-generation':
          output = await this.executeLLM(taskId, input);
          break;
        case 'image-generation':
        case 'background-removal':
        case 'scene-composition':
        case 'model-dressing':
          output = await this.executeImage(taskId, input);
          break;
        case 'video-generation':
          output = await this.executeVideo(taskId, input);
          break;
        default:
          // Try LLM as fallback
          output = await this.executeLLM(taskId, input);
      }

      // Save results
      await this.db.update(generationTasks)
        .set({
          status: 'completed',
          output,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationTasks.id, taskId));

      this.wsService.sendToUser(userId, {
        type: 'task:completed',
        payload: { taskId, output },
      });
    } catch (e: any) {
      this.logger.error(`Task ${taskId} execution failed: ${e.message}`);

      await this.db.update(generationTasks)
        .set({
          status: 'failed',
          errorMessage: e.message,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationTasks.id, taskId));

      this.wsService.sendToUser(userId, {
        type: 'task:failed',
        payload: { taskId, error: e.message },
      });
    }
  }

  private async executeLLM(taskId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const model = (input.model as string) || 'doubao-seed-2-0-lite-260215';
    const prompt = (input.prompt as string) || (input.text as string) || '';

    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: prompt }] },
    ];

    const llmConfig: LLMConfig = { model };

    const response = await this.llmClient.invoke(messages, llmConfig);
    return { content: response.content, model };
  }

  private async executeImage(taskId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const model = (input.model as string) || 'doubao-seed-2-0-lite-260215';
    const prompt = (input.prompt as string) || '';

    const response = await this.imageClient.generate({
      prompt,
      model,
      size: (input.size as string) || '1024x1024',
    });

    const images = response.data.map((img: any) => ({
      url: img.url,
      b64_json: img.b64_json,
      size: img.size,
    }));

    return { images, model };
  }

  private async executeVideo(taskId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const model = (input.model as string) || 'doubao-seed-2-0-lite-260215';
    const prompt = (input.prompt as string) || '';

    const content = [{ type: 'text' as const, text: prompt }];

    const response = await this.videoClient.videoGeneration(content, {
      model,
      resolution: '720p' as any,
      ratio: '16:9' as any,
    });

    return {
      videoUrl: (response as any).videoUrl || (response as any).url || '',
      coverUrl: (response as any).coverUrl || '',
      model,
    };
  }
}