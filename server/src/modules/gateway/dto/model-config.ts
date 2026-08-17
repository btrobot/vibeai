import { z } from 'zod';

const slugSchema = z.string().trim().min(1).max(100).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  '必须使用小写字母、数字和连字符',
);

const jsonObjectSchema = z.record(z.unknown());
const sensitiveKeyPattern = /(api[-_]?key|token|secret|password|authorization|credential)/i;

function containsSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsSensitiveKey);

  return Object.entries(value).some(([key, nested]) => (
    sensitiveKeyPattern.test(key) || containsSensitiveKey(nested)
  ));
}

const providerConfigSchema = jsonObjectSchema.refine(
  (config) => !containsSensitiveKey(config),
  'Provider 配置不得包含密钥、令牌或凭证字段',
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

export const CreateProviderSchema = z.object({
  modelSlug: slugSchema,
  providerName: z.string().trim().min(1).max(100),
  sdkClient: z.enum(['llm', 'image', 'video', 'replicate']),
  sdkModelId: z.string().trim().min(1).max(200),
  priority: z.number().int().positive(),
  costPerCall: z.number().nonnegative().nullable().optional(),
  costPerSecond: z.number().nonnegative().nullable().optional(),
  config: providerConfigSchema.optional(),
}).strict();

export const UpdateProviderSchema = CreateProviderSchema.omit({ modelSlug: true })
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
export type CreateProviderInput = z.infer<typeof CreateProviderSchema>;
export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>;
export type ReplaceCapabilityRoutesInput = z.infer<typeof ReplaceCapabilityRoutesSchema>;
