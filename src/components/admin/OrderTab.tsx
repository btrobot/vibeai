import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShoppingCart,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  DollarSign,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Order, OrderStatus, OrderType, OrderStats } from './types';
import { getAuthHeaders, formatDateTime } from './types';
import { downloadFromUrl, getDownloadTimestamp } from '@/lib/download';
import { useAdminCrud } from '@/hooks/useAdminCrud';

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

export default function OrderTab() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [exportLoading, setExportLoading] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusOrderId, setStatusOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');
  const [statusLoading, setStatusLoading] = useState(false);

  const filterParams = useMemo<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    return params;
  }, [statusFilter]);

  const {
    items,
    loading,
    page,
    total,
    totalPages,
    setPage,
    refetch,
    patchItem,
  } = useAdminCrud<Order>({
    endpoint: '/api/admin/orders',
    filterParams,
  });

  // ===== Stats fetch (separate, with AbortController) =====
  const statsAbortRef = useRef<AbortController | null>(null);
  const fetchStats = useCallback(async () => {
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    try {
      const res = await fetch('/api/admin/orders/stats', {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) return;
      if (controller.signal.aborted) return;
      const result = await res.json();
      if (controller.signal.aborted) return;
      setStats(result.data ?? result);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    fetchStats();
    return () => statsAbortRef.current?.abort();
  }, [fetchStats]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const url = `/api/admin/orders/export?${params}`;
      await downloadFromUrl(url, `orders_${getDownloadTimestamp()}.csv`, {
        headers: { ...getAuthHeaders() },
      });
    } catch {
      // ignore
    } finally {
      setExportLoading(false);
    }
  };

  const openStatusDialog = (order: Order) => {
    setStatusOrderId(order.id);
    setNewStatus(order.status);
    setStatusOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!statusOrderId) return;
    setStatusLoading(true);
    try {
      const targetId = statusOrderId;
      const targetStatus = newStatus;
      await patchItem(
        targetId,
        (order) => ({ ...order, status: targetStatus }),
        async () => {
          const res = await fetch(`/api/admin/orders/${targetId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ status: targetStatus }),
          });
          return res.ok;
        },
      );
      setStatusOpen(false);
      fetchStats();
    } finally {
      setStatusLoading(false);
    }
  };

  const openRefundDialog = (id: string) => {
    setRefundId(id);
    setRefundReason('');
    setRefundOpen(true);
  };

  const handleRefund = async () => {
    if (!refundId || !refundReason.trim()) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${refundId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      if (res.ok) {
        setRefundOpen(false);
        refetch();
        fetchStats();
      }
    } catch {
      // ignore
    } finally {
      setRefundLoading(false);
    }
  };

  const canRefund = (order: Order) =>
    order.status === 'paid' || order.status === 'completed';

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ShoppingCart} label="总订单" value={stats?.totalOrders ?? 0} />
        <StatCard icon={CheckCircle} label="已支付" value={stats?.paidOrders ?? 0} />
        <StatCard icon={Clock} label="待支付" value={stats?.pendingOrders ?? 0} />
        <StatCard
          icon={DollarSign}
          label="总收入"
          value={`¥${(stats?.totalRevenue ?? 0).toFixed(2)}`}
        />
      </div>

      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">状态筛选</label>
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
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exportLoading}>
          {exportLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          导出 CSV
        </Button>
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="暂无订单" description="还没有任何订单记录" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">订单号</th>
                <th className="p-3 text-left font-medium text-muted-foreground">类型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">金额</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3 font-mono text-xs text-foreground">{order.orderNumber}</td>
                  <td className="p-3 text-muted-foreground">{TYPE_LABELS[order.type] ?? order.type}</td>
                  <td className="p-3 font-mono text-foreground">
                    {Number(order.amount).toFixed(2)} {order.currency}
                  </td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openStatusDialog(order)}
                        disabled={statusLoading && statusOrderId === order.id}
                        title="更新状态"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      {canRefund(order) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRefundDialog(order.id)}
                          disabled={refundLoading && refundId === order.id}
                          title="退款"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">共 {total} 条</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>更新订单状态</DialogTitle>
            <DialogDescription>选择新的订单状态</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>订单状态</Label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>取消</Button>
            <Button variant="brand" onClick={handleStatusUpdate} disabled={statusLoading}>
              {statusLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>订单退款</DialogTitle>
            <DialogDescription>请输入退款原因</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="refund-reason">退款原因</Label>
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="请输入退款原因"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleRefund} disabled={refundLoading || !refundReason.trim()}>
              {refundLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              确认退款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof ShoppingCart; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
