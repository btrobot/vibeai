/**
 * LLM 适配器 — 流式文本生成
 *
 * 协议: SYNC_STREAMING
 * 使用 LLMClient.stream() 逐步输出
 * 通过 onProgress 回调将 chunk 推送给 SSE / WebSocket
 */

import { Injectable, Logger } from '@nestjs/common';
import { LLMClient, Config, type LLMConfig, type Message, type ContentPart } from 'coze-coding-dev-sdk';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

@Injectable()
export class LlmAdapter implements ProtocolAdapter {
  readonly protocolKind = 'SYNC_STREAMING' as const;
  readonly modality = 'llm' as const;

  private readonly logger = new Logger(LlmAdapter.name);
  private client: LLMClient | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      const apiKey = process.env.COZE_LOOP_API_TOKEN || process.env.COZE_WORKLOAD_API_TOKEN || '';
      const baseUrl = process.env.COZE_LOOP_BASE_URL || 'https://api.coze.cn';

      if (!apiKey) {
        this.logger.warn('COZE_LOOP_API_TOKEN not set, LLM adapter disabled');
        return;
      }

      const config = new Config({ apiKey, baseUrl });
      this.client = new LLMClient(config);
      this.logger.log('LLM client initialized');
    } catch (e) {
      this.logger.error('Failed to initialize LLM client', e);
    }
  }

  async execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    if (!this.client) {
      throw new Error('LLM 客户端未初始化，请检查 COZE_LOOP_API_TOKEN 配置');
    }

    const messages = this.buildMessages(input);

    const llmConfig: LLMConfig = {
      model: model.sdkModelId,
      temperature: (input.temperature as number) ?? (model.defaultParams.temperature as number) ?? 0.7,
      thinking: input.thinkingMode ? 'enabled' : 'disabled',
    };

    this.logger.log(`LLM streaming: model=${model.sdkModelId}, taskId=${context.taskId}`);

    const stream = this.client.stream(messages, llmConfig);

    let fullContent = '';
    for await (const chunk of stream) {
      const text = chunk.content?.toString() ?? '';
      if (text) {
        fullContent += text;
        context.onProgress?.(0, text);
      }
    }

    return {
      output: {
        content: fullContent,
        modelUsed: model.slug,
      },
    };
  }

  /**
   * 构建 SDK 消息数组
   * 支持：纯文本、多模态（图片+视频）、多轮对话历史
   */
  private buildMessages(input: Record<string, unknown>): Message[] {
    const messages: Message[] = [];

    // 系统提示词
    const systemPrompt = input.systemPrompt as string | undefined;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // 对话历史
    const history = input.conversationHistory as Array<{ role: string; content: string }> | undefined;
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // 当前用户输入（可能含多模态）
    const prompt = (input.prompt as string) || '';
    const images = input.images as string[] | undefined;
    const videos = input.videos as string[] | undefined;

    if (!images?.length && !videos?.length) {
      // 纯文本
      messages.push({ role: 'user', content: prompt });
    } else {
      // 多模态
      const parts: ContentPart[] = [{ type: 'text', text: prompt }];
      if (images?.length) {
        for (const url of images) {
          parts.push({ type: 'image_url', image_url: { url } });
        }
      }
      if (videos?.length) {
        for (const url of videos) {
          parts.push({ type: 'video_url', video_url: { url } });
        }
      }
      messages.push({ role: 'user', content: parts });
    }

    return messages;
  }
}
