/**
 * DashboardPage 组件测试
 *
 * 覆盖范围：
 * - 渲染欢迎信息和统计卡片
 * - 加载中状态
 * - 空创作状态
 * - 有创作数据时的渲染
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import { AuthProvider } from '../contexts/AuthContext';
import DashboardPage from './DashboardPage';

function renderDashboard() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.setItem('auth_tokens', JSON.stringify({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('应该渲染欢迎信息和统计卡片', async () => {
    server.use(
      http.get('/api/projects', () =>
        HttpResponse.json({ total: 3, items: [] }),
      ),
      http.get('/api/creates', () =>
        HttpResponse.json({ total: 5, items: [] }),
      ),
    );

    renderDashboard();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText(/欢迎回来/)).toBeInTheDocument();
    });

    // 统计卡片
    expect(screen.getByText('项目总数')).toBeInTheDocument();
    expect(screen.getByText('创作总数')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('可用额度')).toBeInTheDocument();

    // 统计数值
    expect(screen.getByText('3')).toBeInTheDocument(); // 项目总数
    expect(screen.getByText('5')).toBeInTheDocument(); // 创作总数
    // 0 出现多次（已完成和可用额度），用 getAllByText
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('应该渲染快速创作按钮', async () => {
    server.use(
      http.get('/api/projects', () =>
        HttpResponse.json({ total: 0, items: [] }),
      ),
      http.get('/api/creates', () =>
        HttpResponse.json({ total: 0, items: [] }),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('白底图生成')).toBeInTheDocument();
    });

    expect(screen.getByText('场景合成')).toBeInTheDocument();
    expect(screen.getByText('模特换装')).toBeInTheDocument();
    expect(screen.getByText('视频生成')).toBeInTheDocument();
  });

  it('应该在无创作时显示空状态', async () => {
    server.use(
      http.get('/api/projects', () =>
        HttpResponse.json({ total: 0, items: [] }),
      ),
      http.get('/api/creates', () =>
        HttpResponse.json({ total: 0, items: [] }),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('暂无创作')).toBeInTheDocument();
    });
  });

  it('应该渲染创作列表', async () => {
    server.use(
      http.get('/api/projects', () =>
        HttpResponse.json({ total: 1, items: [] }),
      ),
      http.get('/api/creates', () =>
        HttpResponse.json({
          total: 2,
          items: [
            { id: 'create-1', capabilitySlug: 'image-generation', status: 'completed', prompt: '一只猫', output: { url: 'http://example.com/cat.png' }, taskStatus: 'completed', taskProgress: 100, createdAt: '2026-01-15T10:00:00Z', projectId: 'proj-1' },
            { id: 'create-2', capabilitySlug: 'video-generation', status: 'processing', prompt: '日落', output: null, taskStatus: 'submitting', taskProgress: 60, createdAt: '2026-01-15T12:00:00Z', projectId: 'proj-1' },
          ],
        }),
      ),
      http.get('/api/billing/usage', () =>
        HttpResponse.json({ totalCredits: 1000, usedCredits: 200 }),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText('图像生成').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('视频生成').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(1);
  });
});
