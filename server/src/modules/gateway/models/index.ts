export interface ModelDefinition {
  slug: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  config: Record<string, unknown>;
  inputTypes: string[];
  outputTypes: string[];
  sortOrder: number;
}

export const builtInModels: ModelDefinition[] = [
  {
    slug: 'doubao-seed-2-0-pro-260215',
    name: 'Doubao Seed 2.0 Pro',
    provider: '豆包',
    description: '旗舰级全能通用模型，面向复杂推理与长链路任务执行',
    capabilities: ['text-generation', 'detail-page-generation'],
    config: { supportsThinking: true, supportsCaching: true, maxTokens: 65536 },
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 1,
  },
  {
    slug: 'doubao-seed-2-0-lite-260215',
    name: 'Doubao Seed 2.0 Lite',
    provider: '豆包',
    description: '性能与成本均衡的通用模型，适合高频生产场景',
    capabilities: ['text-generation', 'detail-page-generation'],
    config: { supportsThinking: true, supportsCaching: true, maxTokens: 32768 },
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 2,
  },
  {
    slug: 'doubao-seed-2-0-mini-260215',
    name: 'Doubao Seed 2.0 Mini',
    provider: '豆包',
    description: '低时延高并发场景的轻量模型',
    capabilities: ['text-generation'],
    config: { supportsThinking: true, supportsCaching: true, maxTokens: 16384, maxThinkingLength: 4 },
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 3,
  },
  {
    slug: 'doubao-seed-1-8-251228',
    name: 'Doubao Seed 1.8',
    provider: '豆包',
    description: '多模态 Agent 场景优化模型，更强的多模态理解能力',
    capabilities: ['text-generation'],
    config: { supportsThinking: true, supportsCaching: true },
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 4,
  },
  {
    slug: 'kimi-k2-5-260127',
    name: 'Kimi K2.5',
    provider: '月之暗面',
    description: 'Kimi 迄今最智能的模型，Agent、代码、视觉理解全面领先',
    capabilities: ['text-generation', 'detail-page-generation'],
    config: { supportsThinking: true, fixedTemperature: true, fixedTopP: true },
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 5,
  },
  {
    slug: 'glm-5-0-260211',
    name: 'GLM-5',
    provider: '智谱',
    description: '面向 Agentic Engineering 的旗舰基座模型',
    capabilities: ['text-generation'],
    config: {},
    inputTypes: ['text'],
    outputTypes: ['text'],
    sortOrder: 6,
  },
  {
    slug: 'glm-4-7-251222',
    name: 'GLM-4.7',
    provider: '智谱',
    description: '最新旗舰模型，更强编程与多步推理能力',
    capabilities: ['text-generation'],
    config: {},
    inputTypes: ['text'],
    outputTypes: ['text'],
    sortOrder: 7,
  },
  {
    slug: 'minimax-m2-5-260212',
    name: 'MiniMax M2.5',
    provider: 'MiniMax',
    description: '编码与智能体领域 SOTA 模型',
    capabilities: ['text-generation'],
    config: {},
    inputTypes: ['text'],
    outputTypes: ['text'],
    sortOrder: 8,
  },
  {
    slug: 'qwen-3-5-plus-260215',
    name: 'Qwen 3.5 Plus',
    provider: '阿里云',
    description: '原生视觉语言模型，融合线性注意力与稀疏 MoE',
    capabilities: ['text-generation'],
    config: {},
    inputTypes: ['text', 'image', 'video'],
    outputTypes: ['text'],
    sortOrder: 9,
  },
  {
    slug: 'doubao-seedream-5-0-260128',
    name: 'Doubao SeeDream 5.0',
    provider: '豆包',
    description: '最新一代图片生成模型，画质与风格控制能力领先',
    capabilities: ['image-generation', 'image-editing', 'background-removal', 'scene-composition', 'model-dressing'],
    config: { sizes: ['2K', '4K'], supportsImageToImage: true, supportsSequential: true },
    inputTypes: ['text'],
    outputTypes: ['image'],
    sortOrder: 10,
  },
  {
    slug: 'doubao-seedance-1-5-pro-251215',
    name: 'Doubao Seedance 1.5 Pro',
    provider: '豆包',
    description: '专业级视频生成模型，支持文本到视频与首帧控制',
    capabilities: ['video-generation'],
    config: { maxDuration: 12, minDuration: 4, ratios: ['16:9', '9:16', '1:1'], resolutions: ['480p', '720p', '1080p'] },
    inputTypes: ['text', 'image'],
    outputTypes: ['video'],
    sortOrder: 11,
  },
];

export const builtInModelMap = new Map(builtInModels.map((m) => [m.slug, m]));