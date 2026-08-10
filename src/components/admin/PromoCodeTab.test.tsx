import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import PromoCodeTab from './PromoCodeTab';

describe('PromoCodeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染促销码标题和新建按钮', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <PromoCodeTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('新建促销码')).toBeInTheDocument();
  });

  it('应该加载并显示促销码列表', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'pc-1',
            code: 'SUMMER2024',
            type: 'percentage',
            value: 20,
            maxUses: 100,
            usedCount: 30,
            validFrom: '2026-08-01T00:00:00Z',
            validUntil: '2026-12-31T23:59:59Z',
            minAmount: null,
            isActive: true,
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          },
        ],
        total: 1,
      }),
    });
    render(
      <BrowserRouter>
        <PromoCodeTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('SUMMER2024')).toBeInTheDocument();
      expect(screen.getByText('百分比')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当无促销码时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <PromoCodeTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无促销码')).toBeInTheDocument();
    });
  });
});
