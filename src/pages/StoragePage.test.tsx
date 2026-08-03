/**
 * StoragePage 组件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoragePage from './StoragePage';

// Mock both hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com', name: '测试用户' },
    fetchUser: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
  }),
}));

vi.mock('@/hooks/useStorage', () => {
  const mockFiles = [
    { id: 'file-1', userId: 'user-1', originalName: 'photo.png', mimeType: 'image/png', size: 102400, category: 'image', storageKey: 'key-1', url: '/files/photo.png', isPublic: true, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:00:00Z' },
    { id: 'file-2', userId: 'user-1', originalName: 'video.mp4', mimeType: 'video/mp4', size: 52428800, category: 'video', storageKey: 'key-2', url: '/files/video.mp4', isPublic: false, createdAt: '2026-01-14T10:00:00Z', updatedAt: '2026-01-14T10:00:00Z' },
  ];
  const mockStats = { totalFiles: 2, totalSize: 52531200, byCategory: { image: { count: 1, size: 102400 }, video: { count: 1, size: 52428800 } } };

  let state = { loading: false, error: null };

  return {
    useStorage: () => ({
      ...state,
      uploadFile: vi.fn(),
      listFiles: vi.fn().mockResolvedValue({ items: mockFiles, total: 2, page: 1, pageSize: 20, totalPages: 1 }),
      deleteFile: vi.fn(),
      getStats: vi.fn().mockResolvedValue(mockStats),
    }),
  };
});

function renderStorage() {
  return render(
    <MemoryRouter>
      <StoragePage />
    </MemoryRouter>,
  );
}

describe('StoragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染文件列表', async () => {
    renderStorage();

    await waitFor(() => {
      expect(screen.getByText('photo.png')).toBeInTheDocument();
    });
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
  });

  it('应该显示上传文件按钮', async () => {
    renderStorage();

    await waitFor(() => {
      expect(screen.getByText('上传文件')).toBeInTheDocument();
    });
  });
});