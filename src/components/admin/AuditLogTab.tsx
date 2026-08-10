import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ScrollText, Loader2, ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { AuditLog, AuditLogStats } from './types';
import { getAuthHeaders, formatDateTime, AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from './types';
import { useAdminCrud } from '@/hooks/useAdminCrud';

export default function AuditLogTab() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<AuditLogStats | null>(null);

  const filterParams = useMemo<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (actionFilter !== 'all') params.action = actionFilter;
    if (entityFilter !== 'all') params.entityType = entityFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    return params;
  }, [actionFilter, entityFilter, statusFilter]);

  const { items, loading, page, total, totalPages, setPage } =
    useAdminCrud<AuditLog>({
      endpoint: '/api/admin/audit-logs',
      pageSize: 20,
      filterParams,
    });

  // Fetch stats separately (with AbortController)
  const statsAbortRef = useRef<AbortController | null>(null);
  const fetchStats = useCallback(async () => {
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    try {
      const res = await fetch('/api/admin/audit-logs/stats', {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      if (!res.ok || controller.signal.aborted) return;
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

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard icon={ScrollText} label="总操作数" value={stats?.total ?? 0} />
        <StatCard icon={ShieldCheck} label="成功" value={(stats?.total ?? 0) - (stats?.failed ?? 0)} />
        <StatCard icon={AlertTriangle} label="失败" value={stats?.failed ?? 0} variant="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">操作类型</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">实体类型</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部</option>
            {Object.entries(AUDIT_ENTITY_LABELS).filter(([v]) => v !== 'unknown').map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ScrollText} title="暂无审计日志" description="管理员操作记录将显示在这里" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">操作</th>
                <th className="p-3 text-left font-medium text-muted-foreground">实体类型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">实体 ID</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-left font-medium text-muted-foreground">IP 地址</th>
                <th className="p-3 text-left font-medium text-muted-foreground">时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3">
                    <Badge variant={log.action === 'delete' ? 'destructive' : log.action === 'ban' ? 'warning' : 'default'}>
                      {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                  <td className="p-3 max-w-xs truncate font-mono text-xs text-muted-foreground">{log.entityId ?? '-'}</td>
                  <td className="p-3">
                    <Badge variant={log.status === 'success' ? 'brand' : 'destructive'}>
                      {log.status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{log.ipAddress ?? '-'}</td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, variant }: { icon: typeof ScrollText; label: string; value: string | number; variant?: 'warning' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-semibold ${variant === 'warning' ? 'text-amber-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
