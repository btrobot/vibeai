import { z } from 'zod';

export const GenerateSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  capabilitySlug: z.string().min(1, '能力标识不能为空'),
  modelSlug: z.string().optional(),
  input: z.record(z.unknown()),
  config: z.record(z.unknown()).optional(),
  sourceCreateId: z.string().optional(),
});

export const GenerateResponseSchema = z.object({
  taskId: z.string(),
  status: z.string(),
  capabilitySlug: z.string(),
  modelSlug: z.string(),
  createdAt: z.string(),
});

export type GenerateInput = z.infer<typeof GenerateSchema>;

export const ChatSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
  modelSlug: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  thinkingMode: z.boolean().optional(),
  images: z.array(z.string().url()).optional(),
  videos: z.array(z.string().url()).optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export type ChatInput = z.infer<typeof ChatSchema>;

export const QuickCreateSchema = z.object({
  projectId: z.string().min(1, '项目 ID 不能为空'),
  recipeId: z.string().min(1, '方案 ID 不能为空'),
  input: z.record(z.unknown()).optional(),
});

export type QuickCreateInput = z.infer<typeof QuickCreateSchema>;
