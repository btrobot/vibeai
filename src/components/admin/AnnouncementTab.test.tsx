import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import AnnouncementTab from './AnnouncementTab';

describe('AnnouncementTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染标题和新建按钮', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { total: 0, totalPages: 1 } }),
    });
    render(
      <BrowserRouter>
        <AnnouncementTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('新建公告')).toBeInTheDocument();
  });

  it('应该加载并显示公告列表', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'ann-1',
            title: '系统维护通知',
            content: '今晚维护',
            type: 'maintenance',
            isActive: true,
            isPinned: true,
            scheduledAt: null,
            expiresAt: null,
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      }),
    });
    render(
      <BrowserRouter>
        <AnnouncementTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('系统维护通知')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当无数据时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { total: 0, totalPages: 1 } }),
    });
    render(
      <BrowserRouter>
        <AnnouncementTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无公告')).toBeInTheDocument();
    });
  });

  it('应该显示类型筛选下拉框', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { total: 0, totalPages: 1 } }),
    });
    render(
      <BrowserRouter>
        <AnnouncementTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('类型筛选')).toBeInTheDocument();
  });
});
