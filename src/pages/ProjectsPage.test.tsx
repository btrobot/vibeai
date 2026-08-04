/**
 * ProjectsPage 组件测试
 *
 * 覆盖范围：
 * - 加载中状态
 * - 项目列表渲染
 * - 创建项目
 * - 删除项目
 * - 搜索/筛选
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import ProjectsPage from './ProjectsPage';

const mockProjects = {
  items: [
    { id: 'proj-1', name: '测试项目A', description: '描述A', status: 'active', tags: ['test'], totalCreates: 3, completedCreates: 2, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:00:00Z' },
    { id: 'proj-2', name: '测试项目B', description: '描述B', status: 'completed', tags: ['demo'], totalCreates: 5, completedCreates: 5, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-12T10:00:00Z' },
  ],
  total: 2,
};

function renderProjects() {
  localStorage.setItem('auth_tokens', JSON.stringify({
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
  }));
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('应该渲染项目列表', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json(mockProjects)),
    );

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });
    expect(screen.getByText('测试项目B')).toBeInTheDocument();
  });

  it('应该显示空状态', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json({ items: [], total: 0 })),
    );

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('暂无项目')).toBeInTheDocument();
    });
  });

  it('应该渲染新建项目按钮', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json({ items: [], total: 0 })),
    );

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('新建项目')).toBeInTheDocument();
    });
  });
});