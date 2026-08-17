import { z } from 'zod';

const slugSchema = z.string().trim().min(1).max(100).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  '必须使用小写字母、数字和连字符',
);

const jsonObjectSchema = z.record(z.unknown());
const sensitiveKeyPattern = /(api[-_]?key|token|secret|password|authorization|credential)/i;

const ALLOWED_CHANNEL_CONFIG_KEYS = new Set(['baseurl', 'apikey']); // 与比较时的小写 key 对齐

// 渠道 config 允许存放 baseUrl/apiKey（存 DB 运行时替换，效率优先）。
// 其他凭证类字段（password/secret/token 等）仍禁止，避免误存敏感信息。
function containsForbiddenConfigKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenConfigKey);

  return Object.entries(value).some(([key, nested]) => {
    const lower = key.toLowerCase();
    if (ALLOWED_CHANNEL_CONFIG_KEYS.has(lower)) return containsForbiddenConfigKey(nested);
    return sensitiveKeyPattern.test(key) || containsForbiddenConfigKey(nested);
  });
}

const channelConfigSchema = jsonObjectSchema.refine(
  (config) => !containsForbiddenConfigKey(config),
  '渠道配置仅允许 baseUrl/apiKey，不得包含其他凭证字段',
);

const editableModelFields = {
  name: z.string().trim().min(1).max(255),
  modality: z.enum(['llm', 'image', 'video']),
  capabilities: z.array(slugSchema).min(1),
  description: z.string().trim().max(2000).nullable().optional(),
  outputType: z.string().trim().min(1).max(50),
  inputModes: z.array(z.string().trim().min(1)).optional(),
  constraints: jsonObjectSchema.optional(),
  inputSchema: jsonObjectSchema.optional(),
  defaultParams: jsonObjectSchema.optional(),
  costCredits: z.number().int().nonnegative(),
  tags: z.array(z.string().trim().min(1)).optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  maxOutputTokens: z.number().int().positive().nullable().optional(),
};

export const CreateModelSchema = z.object({
  slug: slugSchema,
  ...editableModelFields,
}).strict();

export const UpdateModelSchema = z.object(editableModelFields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, '至少提供一个可更新字段');

export const SetStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();

// ===== 平台（ai_platforms）：共享账号，baseUrl + apiKey 默认存放处 =====

export const CreatePlatformSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseUrl: z.string().trim().max(500).optional(), // 允许 http(s) 或空；不做强校验，兼容自定义网关
  apiKey: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const UpdatePlatformSchema = CreatePlatformSchema
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, '至少提供一个可更新字段');

// ===== 渠道（model_channels）：平台 × 逻辑模型 × 协议 =====

export const CreateChannelSchema = z.object({
  platformId: z.string().uuid(),
  modelSlug: slugSchema,
  sdkClient: z.enum(['llm', 'image', 'video', 'replicate', 'openai']),
  sdkModelId: z.string().trim().min(1).max(200),
  priority: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  costPerCall: z.number().nonnegative().nullable().optional(),
  costPerSecond: z.number().nonnegative().nullable().optional(),
  config: channelConfigSchema.optional(),
  copyFromId: z.string().uuid().optional(),
}).strict();

export const UpdateChannelSchema = CreateChannelSchema
  .omit({ modelSlug: true, copyFromId: true })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, '至少提供一个可更新字段');

export const ReplaceCapabilityRoutesSchema = z.object({
  modelSlugs: z.array(slugSchema).min(1),
}).strict().refine(
  ({ modelSlugs }) => new Set(modelSlugs).size === modelSlugs.length,
  { path: ['modelSlugs'], message: '路由模型不得重复' },
);

export type CreateModelInput = z.infer<typeof CreateModelSchema>;
export type UpdateModelInput = z.infer<typeof UpdateModelSchema>;
export type SetStatusInput = z.infer<typeof SetStatusSchema>;
export type CreatePlatformInput = z.infer<typeof CreatePlatformSchema>;
export type UpdatePlatformInput = z.infer<typeof UpdatePlatformSchema>;
export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;
export type ReplaceCapabilityRoutesInput = z.infer<typeof ReplaceCapabilityRoutesSchema>;
