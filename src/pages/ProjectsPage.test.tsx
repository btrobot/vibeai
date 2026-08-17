/**
 * ProjectsPage 组件测试
 *
 * 覆盖范围：
 * - 项目列表渲染（卡片视图默认）
 * - 空状态（无项目 / 无匹配）
 * - 新建项目按钮
 * - 卡片/列表视图切换 + localStorage 记忆
 * - 分页（页码显示、上一页/下一页）
 * - 搜索防抖（300ms 后携带 search 参数请求）
 * - 状态筛选（携带 status 参数）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-setup';
import ProjectsPage from './ProjectsPage';

const baseProject = {
  tags: ['test'],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockProjects = {
  items: [
    {
      id: 'proj-1',
      name: '测试项目A',
      description: '描述A',
      status: 'active',
      totalCreates: 3,
      completedCreates: 2,
      ...baseProject,
    },
    {
      id: 'proj-2',
      name: '测试项目B',
      description: '描述B',
      status: 'completed',
      totalCreates: 5,
      completedCreates: 5,
      ...baseProject,
    },
  ],
  total: 2,
};

/** 造一批用于分页的数据（items 长度 = pageSize 12） */
function makePaginated(total: number) {
  return {
    items: Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i + 1}`,
      name: `项目${i + 1}`,
      description: `描述${i + 1}`,
      status: 'active',
      totalCreates: 1,
      completedCreates: 0,
      ...baseProject,
    })),
    total,
  };
}

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
  const user = userEvent.setup();

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('应该渲染项目列表（默认卡片视图）', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json(mockProjects)),
    );

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });
    expect(screen.getByText('测试项目B')).toBeInTheDocument();
    expect(screen.getByText('共 2 个项目')).toBeInTheDocument();
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

  it('应该切换列表视图并记忆偏好', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json(mockProjects)),
    );

    const { container } = renderProjects();
    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });

    const listBtn = screen.getByRole('button', { name: '列表视图' });
    expect(listBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(listBtn);

    expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('project_view')).toBe('list');
    // 列表布局使用 divide-y 容器，卡片布局为 grid
    expect(container.querySelector('.divide-y')).not.toBeNull();
    expect(container.querySelector('.grid')).toBeNull();
  });

  it('应该从 localStorage 恢复视图偏好', async () => {
    localStorage.setItem('project_view', 'list');
    server.use(
      http.get('/api/projects', () => HttpResponse.json(mockProjects)),
    );

    const { container } = renderProjects();
    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.divide-y')).not.toBeNull();
  });

  it('应该渲染分页控件并支持上一页/下一页', async () => {
    server.use(
      http.get('/api/projects', () => HttpResponse.json(makePaginated(25))),
    );

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument();
    });
    expect(screen.getByText('上一页')).toBeDisabled();

    await user.click(screen.getByText('下一页'));
    await waitFor(() => {
      expect(screen.getByText('第 2 / 3 页')).toBeInTheDocument();
    });
    expect(screen.getByText('上一页')).not.toBeDisabled();
  });

  it('搜索防抖后携带 search 参数请求并过滤结果', async () => {
    server.use(
      http.get('/api/projects', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('search');
        return HttpResponse.json(
          q ? { items: [mockProjects.items[0]], total: 1 } : mockProjects,
        );
      }),
    );

    renderProjects();
    await waitFor(() => {
      expect(screen.getByText('测试项目B')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('搜索项目...'), 'A');

    await waitFor(() => {
      expect(screen.queryByText('测试项目B')).not.toBeInTheDocument();
    });
    expect(screen.getByText('测试项目A')).toBeInTheDocument();
  });

  it('搜索无结果时显示无匹配空状态并可清除筛选', async () => {
    server.use(
      http.get('/api/projects', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('search');
        return HttpResponse.json(
          q ? { items: [], total: 0 } : mockProjects,
        );
      }),
    );

    renderProjects();
    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('搜索项目...'), 'zzz');

    await waitFor(() => {
      expect(screen.getByText('无匹配项目')).toBeInTheDocument();
    });

    await user.click(screen.getByText('清除筛选'));
    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('搜索项目...')).toHaveValue('');
  });

  it('状态筛选携带 status 参数', async () => {
    server.use(
      http.get('/api/projects', ({ request }) => {
        const url = new URL(request.url);
        const s = url.searchParams.get('status');
        return HttpResponse.json(
          s ? { items: [mockProjects.items[1]], total: 1 } : mockProjects,
        );
      }),
    );

    renderProjects();
    await waitFor(() => {
      expect(screen.getByText('测试项目A')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '已完成' }));

    await waitFor(() => {
      expect(screen.queryByText('测试项目A')).not.toBeInTheDocument();
    });
    expect(screen.getByText('测试项目B')).toBeInTheDocument();
    expect(screen.getByText('共 1 个项目')).toBeInTheDocument();
  });
});
