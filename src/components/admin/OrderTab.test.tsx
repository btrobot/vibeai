import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import OrderTab from './OrderTab';

describe('OrderTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: 'test-token' }));
  });

  it('应该渲染订单管理标题和导出按钮', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <OrderTab />
      </BrowserRouter>,
    );
    expect(screen.getByText('导出 CSV')).toBeInTheDocument();
    expect(screen.getByText('状态筛选')).toBeInTheDocument();
  });

  it('应该加载并显示统计卡片', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/stats')) {
        return { ok: true, json: async () => ({ totalOrders: 50, paidOrders: 40, pendingOrders: 5, totalRevenue: 999.99 }) };
      }
      return { ok: true, json: async () => ({ items: [], total: 0 }) };
    });
    render(
      <BrowserRouter>
        <OrderTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('总订单')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  it('应该加载并显示订单列表', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/stats')) {
        return { ok: true, json: async () => ({ totalOrders: 1, paidOrders: 1, pendingOrders: 0, totalRevenue: 9.99 }) };
      }
      return {
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
              status: 'paid',
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
      };
    });
    render(
      <BrowserRouter>
        <OrderTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('ORD-20260801-001')).toBeInTheDocument();
      expect(screen.getAllByText('已支付').length).toBeGreaterThan(0);
    });
  });

  it('应该显示空状态当无订单时', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    render(
      <BrowserRouter>
        <OrderTab />
      </BrowserRouter>,
    );
    await vi.waitFor(() => {
      expect(screen.getByText('暂无订单')).toBeInTheDocument();
    });
  });
});
