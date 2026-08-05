/**
 * ProtocolAdapter 接口定义
 *
 * 三种协议类型：
 * - SYNC_STREAMING: LLM 流式，通过 onProgress 回调逐步推送 chunk
 * - SYNC_REQUEST_RESPONSE: 图片生成，同步请求-响应
 * - ASYNC_TASK: 视频生成，SDK 内部轮询 maxWaitTime
 */

export type ProtocolKind = 'SYNC_STREAMING' | 'SYNC_REQUEST_RESPONSE' | 'ASYNC_TASK';

export type Modality = 'llm' | 'image' | 'video';

export interface ExecutionContext {
  taskId: string;
  userId: string;
  customHeaders?: Record<string, string>;
  onProgress?: (progress: number, message: string) => void;
}

export interface ExecutionResult {
  output: Record<string, unknown>;
  providerTaskId?: string;
  rawResponse?: unknown;
}

export interface ProtocolAdapter {
  readonly protocolKind: ProtocolKind;
  readonly modality: Modality;
  readonly sdkClient: string;

  execute(
    input: Record<string, unknown>,
    model: AdapterModel,
    context: ExecutionContext,
  ): Promise<ExecutionResult>;
}

/**
 * 适配器使用的模型信息（从 DB aiModels 行映射）
 */
export interface AdapterModel {
  slug: string;
  name: string;
  sdkModelId: string;
  modality: Modality;
  outputType: string;
  providerName?: string;
  sdkClient: string;
  constraints: Record<string, unknown>;
  defaultParams: Record<string, unknown>;
  costCredits: number;
  sortOrder: number;
}
