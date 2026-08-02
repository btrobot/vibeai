export interface CapabilityDefinition {
  slug: string;
  name: string;
  description: string;
  category: 'text' | 'image' | 'video' | 'analysis';
  icon: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  config: Record<string, unknown>;
  sortOrder: number;
}

export const builtInCapabilities: CapabilityDefinition[] = [
  {
    slug: 'text-generation',
    name: '文本生成',
    description: '基于大语言模型的文本生成与对话，支持多轮交互、思维链推理',
    category: 'text',
    icon: 'message-square',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户输入提示词' },
        systemPrompt: { type: 'string', description: '系统提示词' },
        temperature: { type: 'number', default: 0.7 },
        maxTokens: { type: 'number', default: 4096 },
      },
      required: ['prompt'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        usage: { type: 'object' },
      },
    },
    config: { supportsStreaming: true, supportsThinking: true, supportsCaching: true },
    sortOrder: 1,
  },
  {
    slug: 'image-generation',
    name: '图片生成',
    description: '从文本描述生成高质量图片，支持尺寸、风格控制',
    category: 'image',
    icon: 'image',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述' },
        size: { type: 'string', default: '2K', enum: ['2K', '4K'] },
        count: { type: 'number', default: 1 },
        referenceImage: { type: 'string', description: '参考图片 URL（图生图）' },
      },
      required: ['prompt'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' } },
      },
    },
    config: { supportsImageToImage: true, supportsSequential: true, maxImages: 4 },
    sortOrder: 2,
  },
  {
    slug: 'video-generation',
    name: '视频生成',
    description: '从文本描述生成短视频，支持首帧/尾帧控制、参考视频',
    category: 'video',
    icon: 'video',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '视频描述' },
        duration: { type: 'number', default: 5, description: '视频时长（秒）' },
        ratio: { type: 'string', default: '16:9', enum: ['16:9', '9:16', '1:1'] },
        resolution: { type: 'string', default: '720p', enum: ['480p', '720p', '1080p'] },
        firstFrame: { type: 'string', description: '首帧图片 URL' },
        lastFrame: { type: 'string', description: '尾帧图片 URL' },
      },
      required: ['prompt'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        videoUrl: { type: 'string' },
        lastFrameUrl: { type: 'string' },
      },
    },
    config: { supportsReference: true, maxDuration: 12, minDuration: 4 },
    sortOrder: 3,
  },
  {
    slug: 'image-editing',
    name: '图片编辑',
    description: '基于参考图片与文本指令进行图片编辑与风格变换',
    category: 'image',
    icon: 'wand-2',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '编辑指令' },
        image: { type: 'string', description: '源图片 URL' },
        size: { type: 'string', default: '2K' },
      },
      required: ['prompt', 'image'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' } },
      },
    },
    config: { supportsImageToImage: true },
    sortOrder: 4,
  },
  {
    slug: 'background-removal',
    name: '白底图生成',
    description: '自动去除商品图片背景，生成纯白底商品图，适用于电商主图',
    category: 'image',
    icon: 'crop',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: '商品图片 URL' },
      },
      required: ['image'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
      },
    },
    config: { outputFormat: 'png' },
    sortOrder: 5,
  },
  {
    slug: 'scene-composition',
    name: '场景合成',
    description: '将商品图片合成到指定场景中，生成自然融合的场景图',
    category: 'image',
    icon: 'layers',
    inputSchema: {
      type: 'object',
      properties: {
        productImage: { type: 'string', description: '商品图片 URL' },
        sceneDescription: { type: 'string', description: '场景描述文本' },
        referenceScene: { type: 'string', description: '参考场景图片 URL' },
      },
      required: ['productImage', 'sceneDescription'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' } },
      },
    },
    config: {},
    sortOrder: 6,
  },
  {
    slug: 'model-dressing',
    name: '模特换装',
    description: '将指定服装/商品穿到模特身上，生成自然穿搭效果图',
    category: 'image',
    icon: 'shirt',
    inputSchema: {
      type: 'object',
      properties: {
        garmentImage: { type: 'string', description: '服装图片 URL' },
        modelImage: { type: 'string', description: '模特图片 URL' },
        position: { type: 'string', default: 'auto', description: '穿戴位置' },
      },
      required: ['garmentImage', 'modelImage'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrls: { type: 'array', items: { type: 'string' } },
      },
    },
    config: {},
    sortOrder: 7,
  },
  {
    slug: 'detail-page-generation',
    name: '详情页生成',
    description: '基于商品信息自动生成电商详情页文案与布局建议',
    category: 'text',
    icon: 'file-text',
    inputSchema: {
      type: 'object',
      properties: {
        productName: { type: 'string', description: '商品名称' },
        category: { type: 'string', description: '商品类目' },
        features: { type: 'array', items: { type: 'string' }, description: '商品卖点' },
        targetAudience: { type: 'string', description: '目标人群' },
        images: { type: 'array', items: { type: 'string' }, description: '商品图片 URL' },
      },
      required: ['productName', 'features'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        highlights: { type: 'array' },
        layoutSuggestion: { type: 'string' },
      },
    },
    config: {},
    sortOrder: 8,
  },
  {
    slug: 'style-cloning',
    name: '风格克隆',
    description: '分析参考视频的风格与运镜，生成风格一致的视频内容',
    category: 'video',
    icon: 'clapperboard',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '视频内容描述' },
        referenceVideo: { type: 'string', description: '参考视频 URL' },
        referenceAudio: { type: 'string', description: '参考音频 URL' },
        duration: { type: 'number', default: 5 },
        ratio: { type: 'string', default: '16:9' },
      },
      required: ['prompt', 'referenceVideo'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        videoUrl: { type: 'string' },
        lastFrameUrl: { type: 'string' },
      },
    },
    config: { requiresSeedance2: true },
    sortOrder: 9,
  },
];

export const builtInCapabilityMap = new Map(builtInCapabilities.map((c) => [c.slug, c]));