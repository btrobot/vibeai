import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    initializing: false,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import AdminPage from './AdminPage';

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalUsers: 100,
        activeUsers: 90,
        bannedUsers: 5,
        totalCreditsInCirculation: 15000,
        totalProjects: 500,
        totalTasks: 2000,
        failedTasks: 50,
        totalStorage: 1073741824,
        totalGalleryWorks: 800,
        publishedGalleryWorks: 750,
      }),
    });
  });

  it('应该渲染管理后台标题', () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('管理后台')).toBeInTheDocument();
  });

  it('应该显示三个标签页', () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('数据看板')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByText('内容审核')).toBeInTheDocument();
  });

  it('应该加载并显示统计数据', async () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>,
    );
    await vi.waitFor(
      () => {
        expect(screen.getByText('总用户')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('应该能切换到用户管理标签', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/admin/users')) {
        return {
          ok: true,
          json: async () => ({
            users: [
              {
                id: 'user-1',
                email: 'user@test.com',
                username: 'testuser',
                role: 'user',
                isActive: true,
                creditsRemaining: 100,
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
            total: 100,
            totalPages: 10,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          totalUsers: 100,
          activeUsers: 90,
        }),
      };
    });

    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>,
    );
    const usersTab = screen.getByText('用户管理');
    usersTab.click();

    await vi.waitFor(
      () => {
        expect(screen.getByText('共 100 条')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
