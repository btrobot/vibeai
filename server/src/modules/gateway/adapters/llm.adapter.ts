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
  readonly sdkClient = 'llm';

  private readonly logger = new Logger(LlmAdapter.name);

  /**
   * 按渠道凭证构造 client（对齐 boli GatewayCredentialResolver：凭证来自 DB 平台/渠道配置，
   * env 仅作兜底回退）。
   * 优先级：model.defaultParams.apiKey/baseUrl（ProviderService 合并后的平台/渠道 config）
   *        > env COZE_LOOP_API_TOKEN / COZE_WORKLOAD_API_TOKEN + COZE_LOOP_BASE_URL
   */
  private resolveClient(model: AdapterModel): LLMClient {
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
        `LLM 渠道配置不完整：未设置 COZE_LOOP_API_TOKEN，且渠道未配置 apiKey，无法调用模型 "${model.sdkModelId}"。请配置渠道密钥后重试`,
      );
    }
    return new LLMClient(new Config({ apiKey, baseUrl }));
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

    const messages = this.buildMessages(input);

    const llmConfig: LLMConfig = {
      model: model.sdkModelId,
      temperature: (input.temperature as number) ?? (model.defaultParams.temperature as number) ?? 0.7,
      thinking: input.thinkingMode ? 'enabled' : 'disabled',
    };

    this.logger.log(`LLM streaming: model=${model.sdkModelId}, taskId=${context.taskId}`);

    let stream: ReturnType<typeof client.stream>;
    try {
      stream = client.stream(messages, llmConfig);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('is not iterable') || msg.includes('Cannot read properties')) {
        this.logger.error(`SDK internal error (likely API token/permission issue): ${msg}`);
        throw new Error(
          `LLM API返回了非预期格式的响应。请检查 COZE_LOOP_API_TOKEN 是否具有 LLM 调用权限。原始错误: ${msg}`,
        );
      }
      throw err;
    }

    let fullContent = '';
    try {
      for await (const chunk of stream) {
        // 取消检查：用户取消后立即中止流式输出（SDK 内部轮询尽力而为）
        if (context.signal?.aborted) {
          throw new Error('任务已取消');
        }
        const text = chunk.content?.toString() ?? '';
        if (text) {
          fullContent += text;
          context.onProgress?.(0, text);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('is not iterable') || msg.includes('Cannot read properties')) {
        this.logger.error(`SDK stream error (likely API token/permission issue): ${msg}`);
        throw new Error(
          `LLM 流式响应解析失败。请检查 COZE_LOOP_API_TOKEN 权限或网络连接。原始错误: ${msg}`,
        );
      }
      throw err;
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
