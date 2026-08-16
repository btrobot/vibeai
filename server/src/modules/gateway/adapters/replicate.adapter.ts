/**
 * Replicate 适配器 — 纯 REST 调用（不依赖 replicate npm 包）
 *
 * 协议: ASYNC_TASK（create prediction → poll → extract output）
 * 调用流程：
 * 1. POST /v1/predictions  → { id, status: "starting" }
 * 2. GET /v1/predictions/{id} (轮询, 间隔 1s) → status: "processing" | "succeeded" | "failed"
 * 3. 提取 output，按 model.outputType 映射为统一 ExecutionResult
 *
 * Mock 模式：REPLICATE_API_TOKEN 未设置时自动进入 Mock，与现有适配器行为一致
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ProtocolAdapter, AdapterModel, ExecutionContext, ExecutionResult } from './protocol-adapter.interface';

// ===== Types =====

interface ReplicatePredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: unknown;
  error: string | null;
  logs: string | null;
  urls?: { get: string; cancel?: string };
}

// ===== Adapter =====

@Injectable()
export class ReplicateAdapter implements ProtocolAdapter {
  readonly protocolKind = 'ASYNC_TASK' as const;
  readonly modality = 'image' as const;
  readonly sdkClient = 'replicate';

  private readonly logger = new Logger(ReplicateAdapter.name);
  private readonly apiToken: string | null;
  private readonly baseUrl: string;
  private readonly isMockMode: boolean;

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || null;
    this.baseUrl = process.env.REPLICATE_BASE_URL || 'https://api.replicate.com';
    this.isMockMode = !this.apiToken;

    if (this.isMockMode) {
      this.logger.warn('REPLICATE_API_TOKEN not set, Replicate adapter running in MOCK mode');
    } else {
      this.logger.log('Replicate adapter initialized');
    }
  }

  async execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const prompt = (input.prompt as string) || '';

    // ===== Mock mode =====
    if (this.isMockMode) {
      return this.executeMock(prompt, model, context);
    }

    // ===== Real mode =====
    const modelId = model.sdkModelId;
    const predictionInput = this.buildPredictionInput(input, model);

    this.logger.log(
      `Replicate prediction: model=${modelId}, outputType=${model.outputType}, taskId=${context.taskId}`,
    );

    // Step 1: Create prediction
    context.onProgress?.(5, '正在提交到 Replicate...');

    const createResponse = await this.createPrediction(modelId, predictionInput);
    const predictionId = createResponse.id;

    this.logger.log(`Replicate prediction created: id=${predictionId}, taskId=${context.taskId}`);

    // Step 2: Poll for result
    const maxWaitTime = (model.defaultParams.maxWaitTime as number) || 300;
    const result = await this.pollPrediction(
      predictionId,
      context,
      maxWaitTime,
    );

    // Step 3: Map output
    context.onProgress?.(95, '正在处理结果...');

    const output = this.mapOutput(result.output, model.outputType);

    context.onProgress?.(100, 'Replicate 生成完成');

    return {
      output: {
        ...output,
        modelUsed: model.slug,
        providerName: 'replicate',
        predictionId,
      },
      providerTaskId: predictionId,
      rawResponse: result,
    };
  }

  // ===== Private methods =====

  private buildPredictionInput(
    input: Record<string, unknown>,
    model: AdapterModel,
  ): Record<string, unknown> {
    const predictionInput: Record<string, unknown> = {};

    // Prompt is always included
    if (input.prompt) {
      predictionInput.prompt = input.prompt;
    }

    // Pass through ALL input keys (flexible for different model APIs)
    // Exclude internal keys that are not Replicate API parameters
    const internalKeys = new Set(['maxWaitTime', 'referenceImage', 'referenceImages']);
    for (const [key, value] of Object.entries(input)) {
      if (!internalKeys.has(key) && value !== undefined && key !== 'prompt') {
        predictionInput[key] = value;
      }
    }

    // Merge model.defaultParams (excluding internal keys)
    // Note: provider config is already merged into defaultParams by TaskExecutionService
    const defaultParams = model.defaultParams || {};
    for (const [key, value] of Object.entries(defaultParams)) {
      if (key !== 'maxWaitTime' && predictionInput[key] === undefined) {
        predictionInput[key] = value;
      }
    }

    return predictionInput;
  }

  private async createPrediction(
    modelId: string,
    input: Record<string, unknown>,
  ): Promise<ReplicatePredictionResponse> {
    // Support two modes:
    // 1. Version hash (e.g. "225c978a7f93...") → POST /v1/predictions with { version, input }
    // 2. Owner/model format (e.g. "openai/gpt-image-2") → POST /v1/models/{owner}/{model}/predictions with { input }
    const isModelEndpoint = modelId.includes('/');

    const url = isModelEndpoint
      ? `${this.baseUrl}/v1/models/${modelId}/predictions`
      : `${this.baseUrl}/v1/predictions`;

    const body = isModelEndpoint
      ? { input }
      : { version: modelId, input };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        this.buildHttpErrorMessage(response.status, errorText, '创建 prediction', modelId),
      );
    }

    return response.json() as Promise<ReplicatePredictionResponse>;
  }

  private async pollPrediction(
    predictionId: string,
    context: ExecutionContext,
    maxWaitTime: number,
  ): Promise<ReplicatePredictionResponse> {
    const pollIntervalMs = 1000;
    const maxAttempts = Math.ceil((maxWaitTime * 1000) / pollIntervalMs);
    const startTime = Date.now();

    const maxRetryAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(90, Math.round((elapsed / (maxWaitTime * 1000)) * 80) + 10);

      context.onProgress?.(progress, `Replicate 处理中... (${elapsed / 1000}s)`);

      const response = await fetch(
        `${this.baseUrl}/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        // Transient errors (5xx): retry with backoff; permanent errors (4xx): throw immediately
        if (response.status >= 500 && attempt + 1 < maxRetryAttempts) {
          const backoffMs = 1000 * (attempt + 1);
          this.logger.warn(
            `Replicate 轮询 transient error (HTTP ${response.status}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetryAttempts})`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw new Error(
          this.buildHttpErrorMessage(response.status, errorText, '轮询 prediction'),
        );
      }

      const prediction = await response.json() as ReplicatePredictionResponse;

      if (prediction.status === 'succeeded') {
        this.logger.log(
          `Replicate prediction succeeded: id=${predictionId}, elapsed=${elapsed}ms`,
        );
        return prediction;
      }

      if (prediction.status === 'failed') {
        const errorMsg = prediction.error || 'Replicate prediction 失败（无错误详情）';
        this.logger.error(`Replicate prediction failed: id=${predictionId}, error=${errorMsg}`);
        throw new Error(`Replicate 生成失败: ${errorMsg}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('Replicate prediction 已被取消');
      }

      // Still processing, wait and retry
      await this.delay(pollIntervalMs);
    }

    throw new Error(
      `Replicate prediction 超时 (${maxWaitTime}s): id=${predictionId}`,
    );
  }

  /**
   * 将 Replicate HTTP 错误映射为友好、可行动的中文提示。
   * 避免直接透出原始响应体（可能包含冗长 JSON 或内部信息）。
   */
  private buildHttpErrorMessage(
    status: number,
    errorText: string,
    action: '创建 prediction' | '轮询 prediction',
    modelId?: string,
  ): string {
    // 提取 Replicate 返回的 detail/error 字段作为补充信息（截断防冗长）
    let detail = '';
    try {
      const parsed = JSON.parse(errorText) as { detail?: unknown; error?: unknown };
      if (typeof parsed.detail === 'string') detail = parsed.detail;
      else if (typeof parsed.error === 'string') detail = parsed.error;
    } catch {
      detail = errorText.slice(0, 200);
    }

    switch (status) {
      case 401:
        return 'Replicate API Token 无效或已过期，请检查 REPLICATE_API_TOKEN 配置';
      case 402:
        return 'Replicate 账户余额不足，请到 Replicate 后台充值后重试';
      case 403:
        return 'Replicate 权限不足，请检查 API Token 是否有效';
      case 404:
        return `Replicate ${action} 失败：模型不存在${modelId ? `（${modelId}）` : ''}，请检查模型 ID 配置`;
      case 422:
        return `Replicate 请求参数无效${detail ? `：${detail}` : ''}`;
      case 429:
        return 'Replicate 请求过于频繁（触发限流），请稍后重试';
      default:
        if (status >= 500) {
          return `Replicate 服务暂时不可用（HTTP ${status}），请稍后重试`;
        }
        return `Replicate ${action} 失败 (HTTP ${status})${detail ? `: ${detail}` : ''}`;
    }
  }

  private mapOutput(
    output: unknown,
    outputType: string,
  ): Record<string, unknown> {
    if (outputType === 'image') {
      // Output can be a single URL string, an array of URLs, or an array of objects
      if (typeof output === 'string') {
        return { images: [{ url: output }] };
      }
      if (Array.isArray(output)) {
        const urls = output.filter((v): v is string => typeof v === 'string');
        if (urls.length > 0) {
          return { images: urls.map((url) => ({ url })) };
        }
        // Could be array of objects with url
        const objUrls = output
          .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
          .map((v) => (v.url as string) || (v.image as string))
          .filter((v): v is string => typeof v === 'string');
        if (objUrls.length > 0) {
          return { images: objUrls.map((url) => ({ url })) };
        }
      }
      // Fallback: treat as single image URL
      return { images: [{ url: String(output) }] };
    }

    if (outputType === 'video') {
      if (typeof output === 'string') {
        return { video: { url: output } };
      }
      if (Array.isArray(output) && output.length > 0) {
        return { video: { url: String(output[0]) } };
      }
      return { video: { url: String(output) } };
    }

    // text output
    if (typeof output === 'string') {
      return { content: output };
    }
    if (Array.isArray(output) && output.length > 0) {
      return { content: output.map(String).join('') };
    }
    return { content: JSON.stringify(output) };
  }

  private async executeMock(
    prompt: string,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    this.logger.warn(
      `[MOCK] Replicate: model=${model.sdkModelId}, prompt="${prompt.substring(0, 50)}", taskId=${context.taskId}`,
    );

    context.onProgress?.(20, '[Mock] 提交到 Replicate...');
    await this.delay(400);
    context.onProgress?.(60, '[Mock] Replicate 处理中...');
    await this.delay(400);
    context.onProgress?.(100, '[Mock] Replicate 生成完成');

    const mockUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt.substring(0, 20))}/1024/1024`;

    if (model.outputType === 'video') {
      return {
        output: {
          video: { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
          modelUsed: model.slug,
          mock: true,
        },
        providerTaskId: `mock-replicate-${Date.now()}`,
      };
    }

    if (model.outputType === 'text') {
      return {
        output: {
          content: `[Mock Replicate] 这是模拟文本输出。Prompt: ${prompt}`,
          modelUsed: model.slug,
          mock: true,
        },
        providerTaskId: `mock-replicate-${Date.now()}`,
      };
    }

    // Default: image
    return {
      output: {
        images: [{ url: mockUrl }],
        modelUsed: model.slug,
        mock: true,
      },
      providerTaskId: `mock-replicate-${Date.now()}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
