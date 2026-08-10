import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import ProductTab from './ProductTab';

describe('ProductTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染商品管理标题和新建按钮', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <ProductTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('新建商品')).toBeInTheDocument();
  });

  it('应该加载并显示商品列表', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/categories')) {
        return { ok: true, json: async () => ({ items: [{ id: 'cat-1', name: '服装', slug: 'clothing', parentId: null, icon: null, isActive: true, createdAt: '', updatedAt: '' }], total: 1 }) };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'prod-1',
              userId: 'user-1',
              name: '时尚T恤',
              description: '纯棉T恤',
              categoryId: 'cat-1',
              images: [],
              status: 'active',
              metadata: {},
              createdAt: '2026-08-01T00:00:00Z',
              updatedAt: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
        }),
      };
    });
    render(
      <BrowserRouter>
        <ProductTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('时尚T恤')).toBeInTheDocument();
      expect(screen.getAllByText('服装').length).toBeGreaterThan(0);
      expect(screen.getByText('上架')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当无商品时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <ProductTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无商品')).toBeInTheDocument();
    });
  });
});
