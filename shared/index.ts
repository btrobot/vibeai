import { z } from 'zod';

// ===== Auth Schemas =====

export const RegisterSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z
    .string()
    .min(8, '密码至少8位')
    .regex(/[A-Za-z]/, '密码必须包含字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  name: z.string().min(2, '昵称至少2位').max(50, '昵称最多50位'),
});

export const LoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ===== Response Types =====

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: UserRole;
  credits: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== Enums =====

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  VIP = 'vip',
}

export enum FileCategory {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  TEMP = 'temp',
  PRIVATE = 'private',
  ASSET = 'asset',
  BACKUP = 'backup',
}

export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

// ===== File Schemas =====

export const FileCategorySchema = z.enum([
  'image', 'video', 'audio', 'document', 'temp', 'private', 'asset', 'backup',
]);

export interface FileResponse {
  id: string;
  userId: string;
  name: string;
  originalName: string;
  key: string;
  category: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  isPublic: boolean;
  thumbnailUrl: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileUploadResponse {
  file: FileResponse;
  uploadUrl: string;
}

export interface FileListResponse {
  files: FileResponse[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== Type Exports =====

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type FileCategoryType = z.infer<typeof FileCategorySchema>;