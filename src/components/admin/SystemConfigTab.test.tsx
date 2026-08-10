import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import SystemConfigTab from './SystemConfigTab';

describe('SystemConfigTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染系统配置标题和新建按钮', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    render(
      <BrowserRouter>
        <SystemConfigTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('新建配置')).toBeInTheDocument();
    expect(screen.getByText('分类筛选')).toBeInTheDocument();
  });

  it('应该加载并显示配置列表', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'cfg-1',
            key: 'homepage.carousel',
            value: { items: [] },
            category: 'homepage',
            description: '首页轮播图',
            isPublic: true,
            updatedAt: '2026-08-01T00:00:00Z',
          },
        ],
      }),
    });
    render(
      <BrowserRouter>
        <SystemConfigTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('homepage.carousel')).toBeInTheDocument();
      expect(screen.getAllByText('首页').length).toBeGreaterThan(0);
      expect(screen.getAllByText('公开').length).toBeGreaterThan(0);
    });
  });

  it('应该显示空状态当无配置时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    render(
      <BrowserRouter>
        <SystemConfigTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无配置')).toBeInTheDocument();
    });
  });
});
