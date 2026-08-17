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

// ===== AI Gateway Schemas =====

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

export interface GenerationRequest {
  capabilitySlug: string;
  modelSlug?: string;
  input: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface GenerationTaskResponse {
  taskId: string;
  status: string;
  capabilitySlug: string;
  modelSlug: string;
  createdAt: string;
}

export const GenerationRequestSchema = z.object({
  capabilitySlug: z.string().min(1, '请选择能力'),
  modelSlug: z.string().optional(),
  input: z.record(z.unknown()),
  config: z.record(z.unknown()).optional(),
});

// ===== Billing Types =====

export interface PlanResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  credits: number;
  priceMonthly: number;
  priceYearly: number | null;
  maxProjects: number;
  maxStorageBytes: number;
  maxConcurrentTasks: number;
  capabilities: string[];
  features: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  planId: string;
  plan: PlanResponse | null;
  status: 'active' | 'cancelled' | 'expired' | 'trialing';
  billingCycle: 'monthly' | 'yearly';
  creditsRemaining: number;
  creditsUsed: number;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  createdAt: string;
}

export interface CreditUsageResponse {
  id: string;
  userId: string;
  taskId: string | null;
  credits: number;
  action: string;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface UsageStatsResponse {
  totalCreditsUsed: number;
  creditsRemaining: number;
  creditsUsedThisMonth: number;
  totalTasksCompleted: number;
  totalImagesGenerated: number;
  totalVideosGenerated: number;
  storageUsedBytes: number;
  planSlug: string;
  planName: string;
  periodStart: string;
  periodEnd: string | null;
}

export const CreateSubscriptionSchema = z.object({
  planSlug: z.enum(['free', 'starter', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type FileCategoryType = z.infer<typeof FileCategorySchema>;
export type GenerationRequestInput = z.infer<typeof GenerationRequestSchema>;

// ===== Task Engine Types =====

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface ProjectResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  status: ProjectStatus;
  tags: string[];
  totalCreates: number;
  completedCreates: number;
  createdAt: string;
  updatedAt: string;
}

export const CreateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(200, '项目名称最多200字'),
  description: z.string().max(1000).optional(),
  template: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ===== Create Types =====

export enum CreateStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface CreateResponse {
  id: string;
  projectId: string;
  userId: string;
  capabilitySlug: string;
  prompt: string;
  input: Record<string, unknown>;
  sourceCreateId: string | null;
  status: CreateStatus;
  output: Record<string, unknown> | null;
  modelSlug: string | null;
  taskCount: number;
  errorMessage: string | null;
  taskId: string | null;
  taskStatus: TaskStatus | null;
  taskProgress: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskResponse {
  id: string;
  projectId: string | null;
  createId: string | null;
  userId: string;
  type: string;
  status: TaskStatus;
  priority: number;
  progress: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  modelSlug: string | null;
  capabilitySlug: string | null;
  creditsCost: number;
  providerTaskId: string | null;
  sourceTaskId: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedCompletionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStateResponse {
  id: string;
  taskId: string;
  step: string;
  status: TaskStatus;
  progress: number;
  message: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WsTaskUpdate {
  type: 'task:progress' | 'task:completed' | 'task:failed' | 'task:cancelled';
  payload: {
    taskId: string;
    projectId: string | null;
    status: TaskStatus;
    progress: number;
    step?: string;
    message?: string;
    result?: Record<string, unknown>;
    error?: string;
  };
}