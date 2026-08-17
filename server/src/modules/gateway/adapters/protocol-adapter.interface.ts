/**
 * ProtocolAdapter 接口定义
 *
 * 三种协议类型：
 * - SYNC_STREAMING: LLM 流式，通过 onProgress 回调逐步推送 chunk
 * - SYNC_REQUEST_RESPONSE: 图片生成，同步请求-响应
 * - ASYNC_TASK: 视频生成，SDK 内部轮询 maxWaitTime
 *
 * ── sdkClient 语义（重要，勿误解为"供应商品牌"）──
 *
 * sdkClient = 协议/适配器标识，是 AdapterRegistry.getAdapter(sdkClient) 的查表键，
 * 决定"这个渠道按什么协议、用哪个适配器去调用"。它与供应商/模型是三个独立维度：
 *
 *   模型层   ai_models.slug          调什么（逻辑模型：gpt-image-2）
 *   供应商层：渠道归属的平台名（model_channels → ai_platforms）  用谁的（账号/URL/key 在 config）
 *   协议层   sdkClient               怎么调（适配器/协议：openai）
 *
 * 现有取值：
 *   - 'llm' | 'image' | 'video' → Coze SDK 适配器（coze-coding-dev-sdk 自家协议）
 *   - 'replicate'               → ReplicateAdapter（托管平台统一 predictions 异步 REST）
 *   - 'openai'                  → OpenAIAdapter（OpenAI 标准协议 /v1/chat/completions、
 *                                 /v1/images/generations；ppToken/one-api/Azure 等兼容网关复用）
 *
 * 关键性质：
 *   - 同一个协议可被多个供应商复用（如 gpt-image-2 渠道① sdkClient=replicate 走
 *     Replicate，渠道② sdkClient=openai 走 ppToken——协议与供应商解耦）
 *
 * ── API key 二级解析（模型 > 渠道）──
 *   适配器统一从 merge 后的 model.defaultParams 读取 apiKey/baseUrl：
 *     defaultParams = { ...provider.config, ...model.defaultParams }   // 模型优先
 *   因此 key 可配在两个层级，模型指定的 key 覆盖渠道 key：
 *     ① 模型级：ai_models.defaultParams.{ apiKey, baseUrl }（强制指定走哪个账号）
 *     ② 渠道级：model_channels.config.{ apiKey, baseUrl }（覆盖平台默认）
 *   适配器读取到的 defaultParams 是两者合并后的最终值；未配置任何 key 时显式报错（生产模式不 Mock）。
 *   安全：模型/渠道的 key 在 HTTP 出口（/gateway/models、/admin/model-config）均被脱敏，
 *   只有任务执行链路（TaskExecutionService → Adapter）能看到明文 key。
 *   - 新增协议 = 新 ProtocolAdapter + AdapterRegistry 注册 + DTO sdkClient 枚举，
 *     模型/供应商数据层零改动（如 Anthropic /v1/messages 协议）
 *   - sdkClient 可在 model_channels 行上覆盖 ai_models 的默认值，
 *     实现"同一逻辑模型、不同渠道走不同协议"
 */

export type ProtocolKind = 'SYNC_STREAMING' | 'SYNC_REQUEST_RESPONSE' | 'ASYNC_TASK';

export type Modality = 'llm' | 'image' | 'video';

export interface ExecutionContext {
  taskId: string;
  userId: string;
  customHeaders?: Record<string, string>;
  onProgress?: (progress: number, message: string) => void;
  /** 任务取消信号：用户取消时触发 abort，适配器应尽力中断在途请求 */
  signal?: AbortSignal;
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
  capabilities: string[];
  constraints: Record<string, unknown>;
  defaultParams: Record<string, unknown>;
  costCredits: number;
  sortOrder: number;
}
