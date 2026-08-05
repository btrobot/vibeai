/**
 * BillingPage 组件测试
 *
 * 覆盖范围：
 * - 加载中状态
 * - 渲染套餐列表
 * - 当前订阅状态显示
 * - 用量统计渲染
 * - 订阅操作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import { AuthProvider } from '../contexts/AuthContext';
import BillingPage from './BillingPage';

const mockPlans = [
  {
    id: 'plan-free',
    slug: 'free',
    name: '免费版',
    description: '适合个人试用',
    credits: 100,
    priceMonthly: 0,
    priceYearly: null,
    maxProjects: 3,
    maxStorageBytes: 104857600,
    maxConcurrentTasks: 1,
    capabilities: ['text-generation', 'image-generation'],
    features: {},
    sortOrder: 1,
  },
  {
    id: 'plan-pro',
    slug: 'pro',
    name: '专业版',
    description: '适合专业创作者',
    credits: 2000,
    priceMonthly: 199,
    priceYearly: 1990,
    maxProjects: 50,
    maxStorageBytes: 1073741824,
    maxConcurrentTasks: 5,
    capabilities: ['text-generation', 'image-generation', 'video-generation', 'background-removal'],
    features: {},
    sortOrder: 3,
  },
];

const mockStats = {
  totalCreditsUsed: 50,
  creditsRemaining: 150,
  creditsUsedThisMonth: 30,
  totalTasksCompleted: 25,
  totalImagesGenerated: 20,
  totalVideosGenerated: 5,
  storageUsedBytes: 52428800,
  planSlug: 'free',
  planName: '免费版',
  periodStart: '2026-01-01T00:00:00Z',
  periodEnd: null,
};

function renderBillingPage(token?: string) {
  if (token) {
    localStorage.setItem('auth_tokens', JSON.stringify({
      accessToken: token,
      refreshToken: 'mock-refresh',
    }));
  }
  return render(
    <BrowserRouter>
      <AuthProvider>
        <BillingPage />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('BillingPage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('应该渲染套餐列表', async () => {
    server.use(
      http.get('/api/billing/plans', () =>
        HttpResponse.json({ success: true, data: mockPlans }),
      ),
      http.get('/api/billing/subscription', () =>
        HttpResponse.json({ success: true, data: null }),
      ),
      http.get('/api/billing/stats', () =>
        HttpResponse.json({ success: true, data: mockStats }),
      ),
      http.get('/api/billing/payment-status', () =>
        HttpResponse.json({ enabled: false }),
      ),
    );

    renderBillingPage('mock-token');

    await waitFor(() => {
      expect(screen.getByText('免费版')).toBeInTheDocument();
    });

    expect(screen.getByText('专业版')).toBeInTheDocument();
    expect(screen.getByText('适合个人试用')).toBeInTheDocument();
    expect(screen.getByText('适合专业创作者')).toBeInTheDocument();
  });

  it('应该渲染用量统计', async () => {
    server.use(
      http.get('/api/billing/plans', () =>
        HttpResponse.json({ success: true, data: mockPlans }),
      ),
      http.get('/api/billing/subscription', () =>
        HttpResponse.json({ success: true, data: null }),
      ),
      http.get('/api/billing/stats', () =>
        HttpResponse.json({ success: true, data: mockStats }),
      ),
      http.get('/api/billing/payment-status', () =>
        HttpResponse.json({ enabled: false }),
      ),
    );

    renderBillingPage('mock-token');

    await waitFor(() => {
      expect(screen.getByText('本月已用')).toBeInTheDocument();
    });

    expect(screen.getByText('30')).toBeInTheDocument(); // 本月已用
    expect(screen.getByText('25')).toBeInTheDocument(); // 完成任务
  });

  it('应该显示当前订阅状态', async () => {
    // 使用默认 handler 测试（免费版）
    renderBillingPage('mock-token');

    await waitFor(() => {
      expect(screen.getByText('订阅信息')).toBeInTheDocument();
    });

    // 默认 handler 返回免费版套餐
    expect(screen.getByText('免费版')).toBeInTheDocument();
  });

  it('应该在无 token 时显示加载状态', async () => {
    renderBillingPage(undefined);

    // 页面只显示加载中，没有套餐列表
    expect(screen.queryByText('免费版')).not.toBeInTheDocument();
    // 加载动画应该存在
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});