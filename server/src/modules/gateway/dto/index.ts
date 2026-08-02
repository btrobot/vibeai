import { z } from 'zod';

export const GenerateSchema = z.object({
  capabilitySlug: z.string().min(1, '能力标识不能为空'),
  modelSlug: z.string().optional(),
  input: z.record(z.unknown()),
  config: z.record(z.unknown()).optional(),
});

export const GenerateResponseSchema = z.object({
  taskId: z.string(),
  status: z.string(),
  capabilitySlug: z.string(),
  modelSlug: z.string(),
  createdAt: z.string(),
});

export type GenerateInput = z.infer<typeof GenerateSchema>;