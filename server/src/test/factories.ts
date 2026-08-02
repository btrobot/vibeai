/**
 * 测试数据工厂
 *
 * 提供生成测试数据的工厂函数，每个工厂返回完整类型数据，
 * 支持通过 partial 覆写特定字段。
 *
 * 字段名与 Drizzle Schema 的 TypeScript 属性名保持一致（camelCase）。
 */

// ========== 用户工厂 ==========

export interface TestUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'demo';
  avatar: string | null;
  credits: number;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let userCounter = 1;

export function buildUser(partial?: Partial<TestUser>): TestUser {
  const counter = userCounter++;
  return {
    id: `user-${counter}`,
    email: `test${counter}@vibeai.com`,
    name: `Test User ${counter}`,
    passwordHash: '$2b$10$mockhashedpassword',
    role: 'user',
    avatar: null,
    credits: 100,
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

export function buildAdmin(partial?: Partial<TestUser>): TestUser {
  return buildUser({ role: 'admin', ...partial });
}

export function buildDemoUser(partial?: Partial<TestUser>): TestUser {
  return buildUser({ role: 'demo', credits: 50, ...partial });
}

// ========== 会话工厂 ==========

export interface TestSession {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

let sessionCounter = 1;

export function buildSession(partial?: Partial<TestSession>): TestSession {
  const counter = sessionCounter++;
  return {
    id: `session-${counter}`,
    userId: 'user-1',
    refreshToken: `refresh-token-${counter}`,
    deviceInfo: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 86400000),
    isRevoked: false,
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

// ========== 项目工厂 ==========

export interface TestProject {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  status: 'active' | 'archived' | 'draft';
  thumbnailUrl: string | null;
  tags: string[];
  taskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

let projectCounter = 1;

export function buildProject(partial?: Partial<TestProject>): TestProject {
  const counter = projectCounter++;
  return {
    id: `project-${counter}`,
    name: `Test Project ${counter}`,
    description: `Description for project ${counter}`,
    userId: 'user-1',
    status: 'active',
    thumbnailUrl: null,
    tags: ['test'],
    taskCount: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

// ========== 任务工厂 ==========

export interface TestTask {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  inputParams: Record<string, unknown>;
  outputUrls: string[];
  errorMessage: string | null;
  creditsCost: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let taskCounter = 1;

export function buildTask(partial?: Partial<TestTask>): TestTask {
  const counter = taskCounter++;
  return {
    id: `task-${counter}`,
    projectId: 'project-1',
    userId: 'user-1',
    type: 'text_to_image',
    status: 'queued',
    progress: 0,
    inputParams: { prompt: 'test prompt' },
    outputUrls: [],
    errorMessage: null,
    creditsCost: 10,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

// ========== 订阅套餐工厂 ==========

export interface TestSubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  creditsPerMonth: number;
  maxStorageBytes: number;
  maxConcurrentTasks: number;
  features: Record<string, boolean>;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function buildPlan(partial?: Partial<TestSubscriptionPlan>): TestSubscriptionPlan {
  return {
    id: 'plan-free',
    name: 'Free',
    code: 'free',
    description: 'Free plan',
    priceMonthly: 0,
    priceYearly: null,
    creditsPerMonth: 100,
    maxStorageBytes: 104857600, // 100MB
    maxConcurrentTasks: 1,
    features: { text_to_image: true, background_removal: true },
    isActive: true,
    sortOrder: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

// ========== 文件工厂 ==========

export interface TestFile {
  id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageProvider: string;
  category: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  tags: string[];
  checksum: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function buildFile(partial?: Partial<TestFile>): TestFile {
  return {
    id: 'file-1',
    userId: 'user-1',
    originalName: 'test.png',
    mimeType: 'image/png',
    sizeBytes: 102400,
    storagePath: 'uploads/test.png',
    storageProvider: 'local',
    category: 'image',
    width: 1024,
    height: 768,
    duration: null,
    tags: [],
    checksum: 'abc123',
    isPublic: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

// ========== 批量生成 ==========
export function buildMany<T>(factory: (partial?: Partial<T>) => T, count: number, overrides?: Partial<T>): T[] {
  return Array.from({ length: count }, () => factory(overrides));
}