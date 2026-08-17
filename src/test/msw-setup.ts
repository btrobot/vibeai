import { beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// 默认 MSW handlers（各测试可覆盖）
export const defaultHandlers = [
  http.post('/api/auth/login', () =>
    HttpResponse.json({
      success: true,
      data: {
        user: {
          id: '1',
          email: 'test@vibeai.com',
          name: 'Test User',
          role: 'user',
          avatar_url: null,
        },
        tokens: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 900,
        },
      },
    }),
  ),

  http.get('/api/auth/me', () =>
    HttpResponse.json({
      success: true,
      data: {
        id: '1',
        email: 'test@vibeai.com',
        name: 'Test User',
        role: 'user',
        avatar_url: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    }),
  ),

  http.post('/api/auth/register', () =>
    HttpResponse.json({
      success: true,
      data: {
        user: {
          id: '2',
          email: 'new@vibeai.com',
          name: 'New User',
          role: 'user',
          avatar_url: null,
        },
        tokens: {
          access_token: 'mock-access-token-new',
          refresh_token: 'mock-refresh-token-new',
          expires_in: 900,
        },
      },
    }),
  ),
];

// 默认 billing handlers（各测试可覆盖）
const now = new Date().toISOString();
const defaultGatewayModels = [
  {
    slug: 'doubao-seed-2-0-pro',
    name: 'Doubao Seed 2.0 Pro',
    description: '默认文本生成模型',
    costCredits: 5,
    tags: ['featured'],
    isDefault: true,
    sortOrder: 1,
  },
];
const defaultModelConfiguration = {
  models: [
    {
      id: 'model-1',
      slug: 'doubao-seed-2-0-pro',
      name: 'Doubao Seed 2.0 Pro',
      modality: 'llm',
      capabilities: ['text-generation'],
      description: '默认文本生成模型',
      outputType: 'text',
      costCredits: 5,
      tags: ['featured'],
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
    },
  ],
  providers: [],
  routes: [
    {
      id: 'route-1',
      capabilitySlug: 'text-generation',
      modelSlug: 'doubao-seed-2-0-pro',
      priority: 1,
      isActive: true,
    },
  ],
  capabilities: [
    { slug: 'text-generation', name: '文本生成', sortOrder: 1 },
  ],
};
const defaultBillingPlans = [
  {
    id: 'plan-free', slug: 'free', name: '免费版', description: '适合个人体验',
    credits: 100, priceMonthly: 0, priceYearly: null,
    maxProjects: 3, maxStorageBytes: 104857600, maxConcurrentTasks: 2,
    capabilities: ['text-generation', 'image-generation'],
    features: { apiAccess: true, prioritySupport: false, privateDeployment: false },
    sortOrder: 1, createdAt: now,
  },
  {
    id: 'plan-starter', slug: 'starter', name: '入门版', description: '适合个人创作者',
    credits: 500, priceMonthly: 29, priceYearly: 299,
    maxProjects: 10, maxStorageBytes: 536870912, maxConcurrentTasks: 5,
    capabilities: ['text-generation', 'image-generation', 'video-generation'],
    features: { apiAccess: true, prioritySupport: false, privateDeployment: false },
    sortOrder: 2, createdAt: now,
  },
  {
    id: 'plan-pro', slug: 'pro', name: '专业版', description: '适合专业创作者',
    credits: 2000, priceMonthly: 99, priceYearly: 999,
    maxProjects: 50, maxStorageBytes: 1073741824, maxConcurrentTasks: 10,
    capabilities: ['*'],
    features: { apiAccess: true, prioritySupport: true, privateDeployment: false },
    sortOrder: 3, createdAt: now,
  },
  {
    id: 'plan-enterprise', slug: 'enterprise', name: '企业版', description: '适合团队和企业',
    credits: 8000, priceMonthly: 299, priceYearly: 2999,
    maxProjects: 999, maxStorageBytes: 10737418240, maxConcurrentTasks: 50,
    capabilities: ['*'],
    features: { apiAccess: true, prioritySupport: true, privateDeployment: true },
    sortOrder: 4, createdAt: now,
  },
];

function makeDefaultPlan(slug: string): any {
  return defaultBillingPlans.find((p: any) => p.slug === slug) ?? defaultBillingPlans[0];
}

defaultHandlers.push(
  http.get('/api/billing/plans', () => HttpResponse.json({ success: true, data: defaultBillingPlans })),
  http.get('/api/billing/subscription', () => HttpResponse.json({
    success: true,
    data: {
      id: 'sub-1', userId: 'user-1',
      plan: makeDefaultPlan('free'),
      creditsRemaining: 150,
      creditsUsed: 30,
      currentPeriodStart: '2026-01-01T00:00:00Z',
      currentPeriodEnd: '2026-02-01T00:00:00Z',
      autoRenew: false,
      createdAt: now,
    },
  })),
  http.get('/api/billing/stats', () => HttpResponse.json({
    success: true,
    data: {
      totalCreditsUsed: 30,
      totalTasksCompleted: 25,
      storageUsed: 52428800,
      currentPeriod: { start: '2026-01-01', end: '2026-01-31' },
    },
  })),
  http.get('/api/billing/payment-status', () => HttpResponse.json({ enabled: false })),
  http.get('/api/gateway/models', () => HttpResponse.json({ success: true, data: defaultGatewayModels })),
  // Admin handlers
  http.get('/api/admin/stats', () => HttpResponse.json({
    success: true,
    data: {
      totalUsers: 100,
      activeUsers: 80,
      bannedUsers: 5,
      totalProjects: 50,
      totalTasks: 200,
      failedTasks: 10,
      totalStorage: 52428800,
      totalGalleryWorks: 30,
      publishedGalleryWorks: 25,
      totalCreditsInCirculation: 5000,
    },
  })),
  http.get('/api/admin/users', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    return HttpResponse.json({
      success: true,
      data: {
        users: [
          {
            id: 'u1',
            email: 'user1@test.com',
            name: 'User One',
            avatar: null,
            role: 'user',
            credits: 100,
            isActive: true,
            isEmailVerified: true,
            lastLoginAt: '2026-01-15T00:00:00Z',
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'u2',
            email: 'user2@test.com',
            name: 'User Two',
            avatar: null,
            role: 'admin',
            credits: 500,
            isActive: true,
            isEmailVerified: true,
            lastLoginAt: null,
            createdAt: '2026-01-02T00:00:00Z',
          },
        ],
        total: 100,
        page,
        totalPages: 10,
      },
    });
  }),
  http.patch('/api/admin/users/:id/ban', () => HttpResponse.json({ success: true })),
  http.patch('/api/admin/users/:id/unban', () => HttpResponse.json({ success: true })),
  http.patch('/api/admin/users/:id/role', () => HttpResponse.json({ success: true })),
  http.get('/api/admin/gallery', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    return HttpResponse.json({
      success: true,
      data: {
        works: [
          {
            id: 'w1',
            userId: 'u1',
            title: 'Test Art',
            type: 'image',
            prompt: 'A beautiful landscape',
            modelSlug: 'dall-e-3',
            isPublished: true,
            likes: 10,
            views: 100,
            createdAt: '2026-01-10T00:00:00Z',
          },
        ],
        total: 30,
        page,
        totalPages: 3,
      },
    });
  }),
  http.patch('/api/admin/gallery/:id/unpublish', () => HttpResponse.json({ success: true })),
  http.delete('/api/admin/gallery/:id', () => HttpResponse.json({ success: true })),
  http.get('/api/admin/model-config', () => HttpResponse.json({
    success: true,
    data: defaultModelConfiguration,
  })),
);

export const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
