import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { Order, OrderStatus, OrderType } from '@/components/admin/types';
import { getAuthHeaders, formatDateTime } from '@/components/admin/types';

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'brand' | 'warning' | 'destructive' | 'primary'> = {
  pending: 'warning',
  paid: 'brand',
  processing: 'primary',
  completed: 'brand',
  expired: 'default',
  cancelled: 'default',
  failed: 'destructive',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  processing: '处理中',
  completed: '已完成',
  expired: '已过期',
  cancelled: '已取消',
  failed: '失败',
};

const TYPE_LABELS: Record<OrderType, string> = {
  credit_pack: '积分包',
  subscription: '订阅',
  product: '商品',
  service: '服务',
};

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [paying, setPaying] = useState<string | null>(null);

  const fetchList = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/orders?${params}`, { headers: { ...getAuthHeaders() } });
      if (res.ok) {
        const result = await res.json();
        const data = result.data ?? result;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(Math.ceil((data.total ?? 0) / PAGE_SIZE));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchList(page);
  }, [page, fetchList]);

  const handlePay = async (order: Order) => {
    setPaying(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (res.ok) {
        const result = await res.json();
        const data = result.data ?? result;
        if (data.clientSecret || data.paymentUrl) {
          // Redirect to payment if URL provided
          if (data.paymentUrl) {
            window.location.href = data.paymentUrl;
          }
        }
        fetchList(page);
      }
    } catch {
      // ignore
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">我的订单</h1>
          <p className="text-sm text-muted-foreground mt-1">查看和管理你的订单记录</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">状态</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | OrderStatus);
            setPage(1);
          }}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">全部</option>
          <option value="pending">待支付</option>
          <option value="paid">已支付</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
          <option value="expired">已过期</option>
          <option value="cancelled">已取消</option>
          <option value="failed">失败</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="暂无订单"
          description="你还没有任何订单记录"
        />
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {order.orderNumber}
                    </span>
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[order.type] ?? order.type} · {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold text-foreground">
                    {Number(order.amount).toFixed(2)} {order.currency}
                  </p>
                  {order.credits > 0 && (
                    <p className="text-xs text-muted-foreground">{order.credits} 积分</p>
                  )}
                </div>
              </div>
              {order.status === 'pending' && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => handlePay(order)}
                    disabled={paying === order.id}
                  >
                    {paying === order.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-1 h-4 w-4" />
                    )}
                    立即支付
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">共 {total} 条</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
