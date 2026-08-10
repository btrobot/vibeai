import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import OrdersPage from './OrdersPage';

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染页面标题', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('我的订单')).toBeInTheDocument();
  });

  it('应该显示状态筛选', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>,
    );
    expect(screen.getByText('状态')).toBeInTheDocument();
  });

  it('应该加载并显示订单卡片', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'order-1',
            userId: 'user-1',
            orderNumber: 'ORD-20260801-001',
            type: 'credit_pack',
            amount: '9.99',
            originalAmount: null,
            discountAmount: '0',
            promoCodeId: null,
            currency: 'USD',
            credits: 100,
            status: 'completed',
            paymentId: 'pay-1',
            metadata: {},
            expiresAt: null,
            completedAt: null,
            cancelledAt: null,
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          },
        ],
        total: 1,
      }),
    });
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('ORD-20260801-001')).toBeInTheDocument();
      expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
      expect(screen.getByText('100 积分')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当无订单时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无订单')).toBeInTheDocument();
    });
  });
});
