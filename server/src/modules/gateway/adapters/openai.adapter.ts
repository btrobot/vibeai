/**
 * OpenAI 标准协议适配器 — 同步请求-响应
 *
 * 协议: SYNC_REQUEST_RESPONSE
 * 调用: POST {baseUrl}/images/generations（OpenAI Images API 标准协议）
 * 兼容: 任何 OpenAI 兼容网关（ppToken / one-api / new-api / OpenAI 官方等）
 *
 * 渠道配置（存 DB model_providers.config，经 TaskExecutionService
 * 以 {...model.defaultParams, ...provider.config} 合并后由本适配器读取）：
 *   baseUrl: OpenAI 兼容网关地址，如 https://cn.pptoken.cc/v1
 *   apiKey:  网关密钥
 * 因此 key/url 全部存数据库，运行时可通过管理 API 替换，无需发版。
 *
 * 生产模式：defaultParams.apiKey 未配置时显式报错（不 Mock）。
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

interface OpenAIImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string; type?: string };
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
  error?: { message?: string; type?: string };
}

/** 外部取消信号联动内部超时 controller：任一触发即 abort */
function linkExternalSignal(controller: AbortController, external?: AbortSignal): void {
  if (!external) return;
  if (external.aborted) {
    controller.abort();
  } else {
    external.addEventListener('abort', () => controller.abort(), { once: true });
  }
}

@Injectable()
export class OpenAIAdapter implements ProtocolAdapter {
  readonly protocolKind = 'SYNC_REQUEST_RESPONSE' as const;
  readonly modality = 'image' as const;
  readonly sdkClient = 'openai';

  /** gpt-image 系列 images/generations 的 size 语义：'比例' → OpenAI size（规范输入 aspect_ratio） */
  private static readonly RATIO_TO_SIZE: Record<string, string> = {
    '1:1': '1024x1024',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '4:3': '1536x1024',
    '3:4': '1024x1536',
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    auto: 'auto',
  };

  private readonly logger = new Logger(OpenAIAdapter.name);

  async execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const prompt = (input.prompt as string) || '';
    const modelId = model.sdkModelId;
    const baseUrl = (model.defaultParams.baseUrl as string) || 'https://api.openai.com/v1';
    const apiKey = model.defaultParams.apiKey as string | undefined;
    const timeoutMs = (model.defaultParams.timeoutMs as number) ?? 300_000; // gpt-image 系列生成可达 3-4 分钟

    // LLM channel（text）走 chat completions；image 走 images/generations
    if (model.outputType === 'text') {
      return this.streamChat(input, model, context, baseUrl, apiKey, timeoutMs);
    }

    const size = (input.size as string)
      ?? (input.ratio ? OpenAIAdapter.RATIO_TO_SIZE[input.ratio as string] : undefined)
      ?? (model.defaultParams.size as string)
      ?? '1024x1024';
    const quality = (input.quality as string) ?? (model.defaultParams.quality as string);
    const count = (input.count as number) ?? (input.n as number) ?? (model.defaultParams.n as number) ?? 1;

    // 生产模式：渠道必须配置完整，未配置 apiKey 直接报错（不再 Mock）
    if (!apiKey) {
      throw new Error(
        `OpenAI 兼容网关渠道配置不完整：未设置 apiKey，无法调用模型 "${modelId}"。请配置渠道密钥后重试`,
      );
    }

    // ===== Real mode =====
    const url = `${baseUrl.replace(/\/+$/, '')}/images/generations`;
    this.logger.log(`OpenAI image generation: model=${modelId}, size=${size}, n=${count}, baseUrl=${baseUrl}, taskId=${context.taskId}`);

    context.onProgress?.(10, '正在提交到 OpenAI 兼容网关...');

    const controller = new AbortController();
    linkExternalSignal(controller, context.signal);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          prompt,
          size,
          n: count,
          ...(quality ? { quality } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort')) {
        throw new Error(`OpenAI 兼容网关请求超时（${timeoutMs / 1000}s）：${url}`);
      }
      throw new Error(`OpenAI 兼容网关请求失败：${msg}`);
    } finally {
      clearTimeout(timer);
    }

    let payload: OpenAIImageResponse;
    try {
      payload = (await response.json()) as OpenAIImageResponse;
    } catch {
      throw new Error(`OpenAI 兼容网关返回非 JSON 响应（HTTP ${response.status}）`);
    }

    if (!response.ok) {
      const message = payload.error?.message || `HTTP ${response.status}`;
      throw new Error(`OpenAI 兼容网关调用失败（${response.status}）：${message}`);
    }

    const items = payload.data ?? [];
    if (items.length === 0) {
      throw new Error('OpenAI 兼容网关未返回任何图片数据');
    }

    const images = items.map((item, index) => {
      if (item.url) {
        return { url: item.url };
      }
      if (item.b64_json) {
        // gpt-image 系列常返回 base64；转为 data URL 兜底（transferResult 可直读/转存）
        return { url: `data:image/png;base64,${item.b64_json}`, embedded: true };
      }
      this.logger.warn(`OpenAI response item ${index} has neither url nor b64_json`);
      return {};
    }).filter((img) => Object.keys(img).length > 0);

    context.onProgress?.(100, `生成 ${images.length} 张图片`);

    return {
      output: {
        images,
        modelUsed: model.slug,
      },
      rawResponse: payload,
    };
  }

  // ===== LLM: OpenAI 标准 chat completions（SSE 流式）=====

  private async streamChat(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
    baseUrl: string,
    apiKey: string | undefined,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    const prompt = (input.prompt as string) || '';
    const modelId = model.sdkModelId;

    // 生产模式：渠道必须配置完整，未配置 apiKey 直接报错（不再 Mock）
    if (!apiKey) {
      throw new Error(
        `OpenAI 兼容网关渠道配置不完整：未设置 apiKey，无法调用模型 "${modelId}"。请配置渠道密钥后重试`,
      );
    }

    const messages = this.buildMessages(input);
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    this.logger.log(
      `OpenAI chat streaming: model=${modelId}, messages=${messages.length}, baseUrl=${baseUrl}, taskId=${context.taskId}`,
    );

    context.onProgress?.(5, '正在连接 OpenAI 兼容网关...');

    const controller = new AbortController();
    linkExternalSignal(controller, context.signal);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
          temperature: (input.temperature as number) ?? (model.defaultParams.temperature as number) ?? 0.7,
          ...((input.maxTokens as number) ?? (model.defaultParams.maxTokens as number) ? { max_tokens: (input.maxTokens as number) ?? (model.defaultParams.maxTokens as number) } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort')) {
        throw new Error(`OpenAI 兼容网关请求超时（${timeoutMs / 1000}s）：${url}`);
      }
      throw new Error(`OpenAI 兼容网关请求失败：${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as OpenAIChatResponse | null;
      throw new Error(`OpenAI 兼容网关调用失败（${response.status}）：${payload?.error?.message ?? ''}`);
    }

    // ===== SSE 流式解析 =====
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let done = false;

      while (!done) {
        if (context.signal?.aborted) {
          throw new Error('任务已取消');
        }
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data) as OpenAIChatResponse;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              content += delta;
              context.onProgress?.(0, delta);
            }
          } catch {
            // 忽略 keep-alive / 注释行
          }
        }
      }

      if (content.trim().length === 0) {
        throw new Error('OpenAI 兼容网关流式响应为空');
      }

      context.onProgress?.(100, '生成完成');
      return {
        output: { content, modelUsed: model.slug },
      };
    }

    // ===== 非流式 fallback（网关忽略 stream 时）=====
    const payload = (await response.json()) as OpenAIChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI 兼容网关未返回文本内容');
    }
    context.onProgress?.(100, '生成完成');
    return {
      output: { content, modelUsed: model.slug },
    };
  }

  private buildMessages(input: Record<string, unknown>): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    const systemPrompt = input.systemPrompt as string | undefined;
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    const history = input.conversationHistory as Array<{ role?: string; content?: string }> | undefined;
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item && typeof item.content === 'string') {
          messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content });
        }
      }
    }

    const prompt = (input.prompt as string) || '';
    if (prompt) messages.push({ role: 'user', content: prompt });
    return messages;
  }

}
