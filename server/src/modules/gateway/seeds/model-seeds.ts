/**
 * AI 模型种子数据
 *
 * slug: 用户友好的短标识（去掉日期后缀）
 * sdkModelId: SDK 调用使用的完整版本号
 * modality: llm | image | video
 *
 * 数据来源：coze-coding-dev-sdk 支持的模型列表
 */

import { aiModels, aiPlatforms, capabilityModelRoutes } from '../../../db/schema/gateway';

type ModelSeed = typeof aiModels.$inferInsert;

export const SEED_MODELS: ModelSeed[] = [
  // ===== LLM 模型（6 个）=====
  {
    slug: 'doubao-seed-2-0-pro',
    name: 'Doubao Seed 2.0 Pro',
    providerName: 'doubao',
    description: '旗舰级全能通用模型，面向复杂推理与长链路任务执行',
    capabilities: ['text-generation', 'detail-page-generation'],
    inputModes: ['text', 'image', 'video'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'doubao-seed-2-0-pro-260215',
    sdkClient: 'llm',
    constraints: { supportsThinking: true, supportsCaching: true, maxTokens: 65536 },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        thinkingMode: { type: 'boolean', default: false },
        images: { type: 'array', items: { type: 'string', format: 'uri' }, description: '图片 URL（多模态输入）' },
        videos: { type: 'array', items: { type: 'string', format: 'uri' }, description: '视频 URL（多模态输入）' },
        conversationHistory: { type: 'array', description: '多轮对话历史' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7, thinking: 'disabled' },
    costCredits: 5,
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: 'doubao-seed-2-0-lite',
    name: 'Doubao Seed 2.0 Lite',
    providerName: 'doubao',
    description: '性能与成本均衡的通用模型，适合高频生产场景',
    capabilities: ['text-generation', 'detail-page-generation'],
    inputModes: ['text', 'image', 'video'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'doubao-seed-2-0-lite-260215',
    sdkClient: 'llm',
    constraints: { supportsThinking: true, supportsCaching: true, maxTokens: 32768 },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        thinkingMode: { type: 'boolean', default: false },
        images: { type: 'array', items: { type: 'string', format: 'uri' } },
        videos: { type: 'array', items: { type: 'string', format: 'uri' } },
        conversationHistory: { type: 'array' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7, thinking: 'disabled' },
    costCredits: 2,
    isActive: true,
    isFeatured: false,
    sortOrder: 2,
  },
  {
    slug: 'doubao-seed-2-0-mini',
    name: 'Doubao Seed 2.0 Mini',
    providerName: 'doubao',
    description: '低时延高并发场景的轻量模型',
    capabilities: ['text-generation'],
    inputModes: ['text', 'image', 'video'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'doubao-seed-2-0-mini-260215',
    sdkClient: 'llm',
    constraints: { supportsThinking: true, supportsCaching: true, maxTokens: 16384, maxThinkingLength: 4 },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        thinkingMode: { type: 'boolean', default: false },
        images: { type: 'array', items: { type: 'string', format: 'uri' } },
        videos: { type: 'array', items: { type: 'string', format: 'uri' } },
        conversationHistory: { type: 'array' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7, thinking: 'disabled' },
    costCredits: 1,
    isActive: true,
    isFeatured: false,
    sortOrder: 3,
  },
  {
    slug: 'doubao-seed-1-8',
    name: 'Doubao Seed 1.8',
    providerName: 'doubao',
    description: '多模态 Agent 场景优化模型，更强的多模态理解能力',
    capabilities: ['text-generation'],
    inputModes: ['text', 'image', 'video'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'doubao-seed-1-8-251228',
    sdkClient: 'llm',
    constraints: { supportsThinking: true, supportsCaching: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        thinkingMode: { type: 'boolean', default: false },
        images: { type: 'array', items: { type: 'string', format: 'uri' } },
        videos: { type: 'array', items: { type: 'string', format: 'uri' } },
        conversationHistory: { type: 'array' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7, thinking: 'disabled' },
    costCredits: 2,
    isActive: true,
    isFeatured: false,
    sortOrder: 4,
  },
  {
    slug: 'kimi-k2-5',
    name: 'Kimi K2.5',
    providerName: 'moonshot',
    description: 'Kimi 迄今最智能的模型，Agent、代码、视觉理解全面领先',
    capabilities: ['text-generation', 'detail-page-generation'],
    inputModes: ['text', 'image', 'video'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'kimi-k2-5-260127',
    sdkClient: 'llm',
    constraints: { supportsThinking: true, fixedTemperature: true, fixedTopP: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        thinkingMode: { type: 'boolean', default: false },
        images: { type: 'array', items: { type: 'string', format: 'uri' } },
        videos: { type: 'array', items: { type: 'string', format: 'uri' } },
        conversationHistory: { type: 'array' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.6, thinking: 'disabled' },
    costCredits: 3,
    isActive: true,
    isFeatured: false,
    sortOrder: 5,
  },
  {
    slug: 'glm-5-0',
    name: 'GLM-5',
    providerName: 'zhipu',
    description: '面向 Agentic Engineering 的旗舰基座模型',
    capabilities: ['text-generation'],
    inputModes: ['text'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'glm-5-0-260211',
    sdkClient: 'llm',
    constraints: {},
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        conversationHistory: { type: 'array' },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7 },
    costCredits: 2,
    isActive: true,
    isFeatured: false,
    sortOrder: 6,
  },

  // ===== 图片生成模型（2 个）=====
  {
    slug: 'doubao-seedream-5-0',
    name: 'Doubao SeeDream 5.0',
    providerName: 'doubao',
    description: '最新一代图片生成模型，画质与风格控制能力领先',
    capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'],
    inputModes: ['text'],
    outputType: 'image',
    modality: 'image',
    sdkModelId: 'doubao-seedream-5-0-260128',
    sdkClient: 'image',
    constraints: { sizes: ['2K', '4K'], supportsImageToImage: true, supportsSequential: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        size: { type: 'string', enum: ['2K', '4K'], default: '2K' },
        watermark: { type: 'boolean', default: true },
        referenceImages: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 9, description: '参考图片 URL（图生图）' },
        sequentialImageGeneration: { type: 'string', enum: ['auto', 'disabled'], default: 'disabled' },
      },
      required: ['prompt'],
    },
    defaultParams: { size: '2K', watermark: true },
    costCredits: 10,
    isActive: true,
    isFeatured: true,
    sortOrder: 10,
  },
  {
    slug: 'doubao-seedream-4-5',
    name: 'Doubao SeeDream 4.5',
    providerName: 'doubao',
    description: '通用高质量图片生成模型',
    capabilities: ['image-generation', 'image-editing'],
    inputModes: ['text'],
    outputType: 'image',
    modality: 'image',
    sdkModelId: 'doubao-seedream-4-5-251128',
    sdkClient: 'image',
    constraints: { sizes: ['2K', '4K'], supportsImageToImage: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        size: { type: 'string', enum: ['2K', '4K'], default: '2K' },
        watermark: { type: 'boolean', default: true },
        referenceImages: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 9 },
      },
      required: ['prompt'],
    },
    defaultParams: { size: '2K', watermark: true },
    costCredits: 8,
    isActive: true,
    isFeatured: false,
    sortOrder: 11,
  },
  // ===== pptoken OpenAI 协议模型（1 个）=====
  {
    slug: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    providerName: 'pptoken',
    description: 'GPT-5.6 Sol 旗舰推理模型（pptoken OpenAI 兼容网关，key 配置在平台/渠道）',
    capabilities: ['text-generation', 'detail-page-generation'],
    inputModes: ['text'],
    outputType: 'text',
    modality: 'llm',
    sdkModelId: 'gpt-5.6-sol',
    sdkClient: 'openai',
    constraints: { supportsThinking: true, supportsCaching: false, maxTokens: 32768 },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
      },
      required: ['prompt'],
    },
    defaultParams: { temperature: 0.7 },
    costCredits: 10,
    isActive: true,
    isFeatured: false,
    sortOrder: 15,
  },

  // ===== 视频生成模型（2 个）=====
  {
    slug: 'doubao-seedance-1-5-pro',
    name: 'Doubao Seedance 1.5 Pro',
    providerName: 'doubao',
    description: '专业级视频生成模型，支持文本到视频与首帧控制',
    capabilities: ['video-generation'],
    inputModes: ['text', 'image'],
    outputType: 'video',
    modality: 'video',
    sdkModelId: 'doubao-seedance-1-5-pro-251215',
    sdkClient: 'video',
    constraints: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1'], resolutions: ['480p', '720p', '1080p'] },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '视频描述' },
        duration: { type: 'number', minimum: 4, maximum: 12, default: 5, description: '视频时长（秒）' },
        ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '16:9' },
        resolution: { type: 'string', enum: ['480p', '720p', '1080p'], default: '720p' },
        watermark: { type: 'boolean', default: true },
        generateAudio: { type: 'boolean', default: true },
        firstFrame: { type: 'string', format: 'uri', description: '首帧图片 URL' },
        lastFrame: { type: 'string', format: 'uri', description: '尾帧图片 URL' },
        seed: { type: 'number', description: '随机种子' },
        cameraFixed: { type: 'boolean', default: false },
      },
      required: ['prompt'],
    },
    defaultParams: { duration: 5, ratio: '16:9', resolution: '720p', watermark: true, generateAudio: true, returnLastFrame: true, maxWaitTime: 900 },
    costCredits: 30,
    isActive: true,
    isFeatured: true,
    sortOrder: 20,
  },
  {
    slug: 'doubao-seedance-2-0',
    name: 'Doubao Seedance 2.0',
    providerName: 'doubao',
    description: '下一代多模态视频创作模型，支持参考图片/视频/音频',
    capabilities: ['video-generation', 'style-cloning'],
    inputModes: ['text', 'image', 'video', 'audio'],
    outputType: 'video',
    modality: 'video',
    sdkModelId: 'doubao-seedance-2-0-260128',
    sdkClient: 'video',
    constraints: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'], resolutions: ['480p', '720p', '1080p'], supportsMultimodalReference: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '视频描述' },
        duration: { type: 'number', minimum: 4, maximum: 12, default: 5 },
        ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'], default: '16:9' },
        resolution: { type: 'string', enum: ['480p', '720p', '1080p'], default: '720p' },
        watermark: { type: 'boolean', default: true },
        generateAudio: { type: 'boolean', default: true },
        referenceImages: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 9, description: '参考图片 URL' },
        referenceVideos: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 3, description: '参考视频 URL' },
        referenceAudios: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 3, description: '参考音频 URL' },
        firstFrame: { type: 'string', format: 'uri', description: '首帧图片 URL（与 referenceImages 互斥）' },
        lastFrame: { type: 'string', format: 'uri', description: '尾帧图片 URL' },
        seed: { type: 'number' },
        cameraFixed: { type: 'boolean', default: false },
      },
      required: ['prompt'],
    },
    defaultParams: { duration: 5, ratio: '16:9', resolution: '720p', watermark: true, generateAudio: true, returnLastFrame: true, maxWaitTime: 900 },
    costCredits: 50,
    isActive: true,
    isFeatured: false,
    sortOrder: 21,
  },


  // ===== Replicate 模型（3 个）=====
  {
    slug: 'gpt-image-2',
    name: 'GPT Image 2',
    providerName: 'replicate',
    description: 'OpenAI GPT Image 2 via Replicate, 高质量图片生成与编辑',
    // L2 后处理（白底/场景/换装）经独立工具页路由到本模型时，走 pptoken(openai) 渠道
    capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'],
    inputModes: ['text', 'image'],
    outputType: 'image',
    modality: 'image',
    sdkModelId: 'openai/gpt-image-2',
    sdkClient: 'replicate',
    constraints: { supportsImageToImage: true },
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        image: { type: 'string', format: 'uri', description: '参考图片 URL（图生图）' },
        quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'], default: 'low', description: '图片质量（low 最便宜）' },
        aspect_ratio: { type: 'string', enum: ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', 'auto'], default: '1:1' },
        output_format: { type: 'string', enum: ['webp', 'png', 'jpeg'], default: 'webp' },
        number_of_images: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
      },
      required: ['prompt'],
    },
    defaultParams: { maxWaitTime: 300, quality: 'low', output_format: 'webp', number_of_images: 1, aspect_ratio: '1:1' },
    costCredits: 10,
    isActive: true,
    isFeatured: false,
    sortOrder: 30,
  },
  {
    slug: 'sdxl',
    name: 'Stable Diffusion XL',
    providerName: 'replicate',
    description: 'Stability AI SDXL via Replicate, 开源高质量图片生成',
    capabilities: ['image-generation'],
    inputModes: ['text'],
    outputType: 'image',
    modality: 'image',
    sdkModelId: 'stability-ai/sdxl',
    sdkClient: 'replicate',
    constraints: {},
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        negative_prompt: { type: 'string', description: '负面提示词' },
        width: { type: 'integer', default: 1024 },
        height: { type: 'integer', default: 1024 },
        num_inference_steps: { type: 'integer', default: 30 },
        guidance_scale: { type: 'number', default: 7.5 },
      },
      required: ['prompt'],
    },
    defaultParams: { maxWaitTime: 300 },
    costCredits: 5,
    isActive: true,
    isFeatured: false,
    sortOrder: 31,
  },
  {
    slug: 'flux-schnell',
    name: 'FLUX Schnell',
    providerName: 'replicate',
    description: 'Black Forest Labs FLUX Schnell via Replicate, 极速高质量图片生成',
    capabilities: ['image-generation'],
    inputModes: ['text'],
    outputType: 'image',
    modality: 'image',
    sdkModelId: 'black-forest-labs/flux-schnell',
    sdkClient: 'replicate',
    constraints: {},
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        width: { type: 'integer', default: 1024 },
        height: { type: 'integer', default: 1024 },
        num_outputs: { type: 'integer', default: 1 },
      },
      required: ['prompt'],
    },
    defaultParams: { maxWaitTime: 300 },
    costCredits: 3,
    isActive: true,
    isFeatured: false,
    sortOrder: 32,
  },
];

/**
 * 平台 + 渠道种子数据（平台维度）
 *
 * 平台：由模型默认 providerName 去重生成。起步阶段每平台一个共享账号，
 *       baseUrl/apiKey 不在种子中硬编码（运行时在 Admin 后台配置，效率优先）。
 * 渠道：每个逻辑模型一个渠道实例，config 留空（继承平台默认账号）。
 */
type PlatformSeed = typeof aiPlatforms.$inferInsert;

export interface ChannelSeed {
  platformName: string;
  modelSlug: string;
  sdkModelId: string;
  sdkClient: string;
  priority: number;
  costPerCall: string | null;
  config: Record<string, unknown>;
}

const channelCostPerCall: Record<string, string> = {
  'gpt-5.6-sol': '0.05',
  'gpt-image-2': '0.05',
  sdxl: '0.002',
  'flux-schnell': '0.003',
};

export const SEED_PLATFORMS: PlatformSeed[] = Array.from(
  new Set(SEED_MODELS.map((model) => model.providerName as string)),
).map((name) => ({ name }));

export const SEED_CHANNELS: ChannelSeed[] = [
  ...SEED_MODELS.map((model) => ({
    platformName: model.providerName as string,
    modelSlug: model.slug as string,
    sdkModelId: model.sdkModelId as string,
    sdkClient: model.sdkClient as string,
    // gpt-image-2 默认走 pptoken(openai)，replicate 渠道降级为备用
    priority: model.slug === 'gpt-image-2' ? 2 : 1,
    costPerCall: channelCostPerCall[model.slug as string] ?? null,
    config: {},
  })),
  // 附加渠道：gpt-image-2 优先走 pptoken OpenAI 协议（key 配置在平台，seed 不硬编码）
  {
    platformName: 'pptoken',
    modelSlug: 'gpt-image-2',
    sdkModelId: 'gpt-image-2',
    sdkClient: 'openai',
    priority: 1,
    costPerCall: null,
    config: {},
  },
];

type ModelRouteSeed = typeof capabilityModelRoutes.$inferInsert;

export const SEED_MODEL_ROUTES: ModelRouteSeed[] = [
  // doubao 平台（8 模型）未配置任何渠道凭证（platform base_url/api_key 为空、渠道 config={}），
  // 2026-08-19 从路由表移除：避免每次生成先命中 doubao 再「无可用渠道」过滤告警。
  // 后续在 Admin → 模型配置补全 doubao 渠道凭证后，可经 replaceCapabilityRoutes 重新加入。
  { capabilitySlug: 'text-generation', modelSlug: 'gpt-5.6-sol', priority: 1, isActive: true },
  { capabilitySlug: 'image-generation', modelSlug: 'gpt-image-2', priority: 1, isActive: true },
  { capabilitySlug: 'image-generation', modelSlug: 'sdxl', priority: 2, isActive: true },
  { capabilitySlug: 'image-generation', modelSlug: 'flux-schnell', priority: 3, isActive: true },
  { capabilitySlug: 'image-editing', modelSlug: 'gpt-image-2', priority: 1, isActive: true },
  { capabilitySlug: 'background-removal', modelSlug: 'gpt-image-2', priority: 1, isActive: true },
  { capabilitySlug: 'scene-composition', modelSlug: 'gpt-image-2', priority: 1, isActive: true },
  { capabilitySlug: 'model-dressing', modelSlug: 'gpt-image-2', priority: 1, isActive: true },
  { capabilitySlug: 'detail-page-generation', modelSlug: 'kimi-k2-5', priority: 1, isActive: true },
  { capabilitySlug: 'detail-page-generation', modelSlug: 'gpt-5.6-sol', priority: 2, isActive: true },
];

/**
 * 快捷创作方案种子数据
 */
export interface RecipeSeed {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilitySlug: string;
  modelSlug: string;
  defaultInput: Record<string, unknown>;
  sortOrder: number;
}

export const SEED_RECIPES: RecipeSeed[] = [
  {
    id: 'text-to-image',
    name: '文生图',
    description: '输入文字描述，生成高质量图片',
    icon: 'image',
    capabilitySlug: 'image-generation',
    modelSlug: 'doubao-seedream-5-0',
    defaultInput: { size: '2K' },
    sortOrder: 1,
  },
  {
    id: 'image-to-image',
    name: '图生图',
    description: '上传参考图 + 描述，生成风格变换图片',
    icon: 'wand-2',
    capabilitySlug: 'image-editing',
    modelSlug: 'doubao-seedream-5-0',
    defaultInput: { size: '2K' },
    sortOrder: 2,
  },
  {
    id: 'text-to-video',
    name: '文生视频',
    description: '输入文字描述，生成短视频',
    icon: 'video',
    capabilitySlug: 'video-generation',
    modelSlug: 'doubao-seedance-1-5-pro',
    defaultInput: { duration: 5, ratio: '16:9', resolution: '720p' },
    sortOrder: 3,
  },
  {
    id: 'image-to-video',
    name: '图生视频',
    description: '上传图片作为首帧 + 描述，生成视频',
    icon: 'film',
    capabilitySlug: 'video-generation',
    modelSlug: 'doubao-seedance-1-5-pro',
    defaultInput: { duration: 5, ratio: '16:9', resolution: '720p' },
    sortOrder: 4,
  },
  {
    id: 'prompt-enhance',
    name: '提示词增强',
    description: '用 LLM 优化图片/视频生成的提示词',
    icon: 'sparkles',
    capabilitySlug: 'text-generation',
    modelSlug: 'doubao-seed-2-0-lite',
    defaultInput: { systemPrompt: '你是一个专业的 AI 绘画提示词优化专家。请将用户输入的简单描述扩展为一段详细的、适合图片生成模型的英文提示词。直接输出优化后的提示词，不要任何额外解释。' },
    sortOrder: 5,
  },
  {
    id: 'detail-page-copy',
    name: '详情页文案',
    description: '基于商品信息生成电商详情页文案',
    icon: 'file-text',
    capabilitySlug: 'detail-page-generation',
    modelSlug: 'doubao-seed-2-0-pro',
    defaultInput: { systemPrompt: '你是一个专业的电商文案撰写专家。请根据用户提供的商品信息，生成吸引人的详情页文案。' },
    sortOrder: 6,
  },
];
