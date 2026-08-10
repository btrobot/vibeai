import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import AnnouncementBanner from './AnnouncementBanner';

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('当无活跃公告时不渲染', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    const { container } = render(<AnnouncementBanner />);
    await vi.waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('应该显示活跃公告', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'ann-1',
            title: '系统维护通知',
            content: '今晚 22:00-23:00 维护',
            type: 'info',
            isPinned: true,
          },
        ],
      }),
    });
    render(<AnnouncementBanner />);
    await vi.waitFor(() => {
      expect(screen.getByText('系统维护通知')).toBeInTheDocument();
      expect(screen.getByText('今晚 22:00-23:00 维护')).toBeInTheDocument();
    });
  });

  it('应该显示警告类型公告', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'ann-2',
            title: '紧急通知',
            content: '系统升级',
            type: 'warning',
            isPinned: false,
          },
        ],
      }),
    });
    render(<AnnouncementBanner />);
    await vi.waitFor(() => {
      expect(screen.getByText('紧急通知')).toBeInTheDocument();
    });
  });

  it('fetch 失败时不渲染', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { container } = render(<AnnouncementBanner />);
    await vi.waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
