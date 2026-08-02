import { z } from 'zod';

export const FileCategory = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  TEMP: 'temp',
  PRIVATE: 'private',
  ASSET: 'asset',
  BACKUP: 'backup',
} as const;

export const fileCategoryValues = Object.values(FileCategory);
export type FileCategoryType = (typeof FileCategory)[keyof typeof FileCategory];

export const uploadFileSchema = z.object({
  category: z.enum(['image', 'video', 'audio', 'document', 'temp', 'private', 'asset', 'backup']).optional().default('temp'),
  isPublic: z.boolean().optional().default(false),
});

export const listFilesQuerySchema = z.object({
  category: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
});

export const fileResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  category: z.enum(['image', 'video', 'audio', 'document', 'temp', 'private', 'asset', 'backup']),
  storageKey: z.string(),
  url: z.string(),
  isPublic: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
export type FileResponse = z.infer<typeof fileResponseSchema>;