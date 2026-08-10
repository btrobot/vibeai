import { useState, useRef } from 'react';
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { PromoCode, PromoCodeType, PromoCodeUsageStats } from './types';
import { getAuthHeaders, formatDate } from './types';
import { useAdminCrud } from '@/hooks/useAdminCrud';

interface FormState {
  code: string;
  type: PromoCodeType;
  value: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  minAmount: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  code: '',
  type: 'fixed',
  value: '',
  maxUses: '',
  validFrom: '',
  validUntil: '',
  minAmount: '',
  isActive: true,
};

export default function PromoCodeTab() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageStats, setUsageStats] = useState<PromoCodeUsageStats | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const {
    items,
    loading,
    page,
    total,
    totalPages,
    setPage,
    create,
    update,
    remove,
  } = useAdminCrud<PromoCode>({
    endpoint: '/api/admin/commerce/promo-codes',
  });

  const usageAbortRef = useRef<AbortController | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, validFrom: new Date().toISOString().slice(0, 16) });
    setDialogOpen(true);
  };

  const openEdit = (item: PromoCode) => {
    setEditingId(item.id);
    setForm({
      code: item.code,
      type: item.type,
      value: String(item.value),
      maxUses: item.maxUses ? String(item.maxUses) : '',
      validFrom: item.validFrom ? item.validFrom.slice(0, 16) : '',
      validUntil: item.validUntil ? item.validUntil.slice(0, 16) : '',
      minAmount: item.minAmount ? String(item.minAmount) : '',
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.value) return;
    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        isActive: form.isActive,
      };
      if (form.maxUses) body.maxUses = Number(form.maxUses);
      if (form.validFrom) body.validFrom = new Date(form.validFrom).toISOString();
      if (form.validUntil) body.validUntil = new Date(form.validUntil).toISOString();
      if (form.minAmount) body.minAmount = Number(form.minAmount);

      if (editingId) {
        await update(editingId, body);
      } else {
        await create(body);
      }
      setDialogOpen(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此促销码吗？')) return;
    setActionLoading(`del-${id}`);
    try {
      await remove(id);
    } finally {
      setActionLoading(null);
    }
  };

  const openUsage = async (id: string) => {
    setUsageOpen(true);
    setUsageStats(null);
    setUsageLoading(true);
    usageAbortRef.current?.abort();
    const controller = new AbortController();
    usageAbortRef.current = controller;
    try {
      const res = await fetch(`/api/admin/commerce/promo-codes/${id}/usage`, {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) return;
      if (controller.signal.aborted) return;
      const result = await res.json();
      if (controller.signal.aborted) return;
      setUsageStats(result.data ?? result);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    } finally {
      if (!controller.signal.aborted) setUsageLoading(false);
    }
  };

  const closeUsage = () => {
    usageAbortRef.current?.abort();
    setUsageOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="brand" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建促销码
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Ticket} title="暂无促销码" description="点击「新建促销码」创建第一个促销码" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">促销码</th>
                <th className="p-3 text-left font-medium text-muted-foreground">类型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">折扣值</th>
                <th className="p-3 text-left font-medium text-muted-foreground">使用次数</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-left font-medium text-muted-foreground">有效期</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3 font-mono font-medium text-foreground">{item.code}</td>
                  <td className="p-3">
                    <Badge variant={item.type === 'percentage' ? 'primary' : 'default'}>
                      {item.type === 'percentage' ? '百分比' : '固定'}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-foreground">
                    {item.type === 'percentage' ? `${item.value}%` : `¥${item.value}`}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.usedCount}
                    {item.maxUses ? ` / ${item.maxUses}` : ' / ∞'}
                  </td>
                  <td className="p-3">
                    <Badge variant={item.isActive ? 'brand' : 'default'}>
                      {item.isActive ? '激活' : '停用'}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatDate(item.validFrom)} ~ {formatDate(item.validUntil)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openUsage(item.id)} title="使用统计">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title="编辑">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={actionLoading === `del-${item.id}`}
                        title="删除"
                      >
                        {actionLoading === `del-${item.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑促销码' : '新建促销码'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改促销码设置' : '创建新的促销码'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pc-code">促销码</Label>
                <Input
                  id="pc-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="如 SUMMER2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-type">折扣类型</Label>
                <select
                  id="pc-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PromoCodeType })}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="fixed">固定金额</option>
                  <option value="percentage">百分比</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pc-value">折扣值</Label>
                <Input
                  id="pc-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'percentage' ? '如 20' : '如 10'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-maxuses">最大使用次数</Label>
                <Input
                  id="pc-maxuses"
                  type="number"
                  min="1"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="不限留空"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-minamount">最低消费</Label>
                <Input
                  id="pc-minamount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                  placeholder="不限留空"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pc-from">生效时间</Label>
                <Input
                  id="pc-from"
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-until">失效时间</Label>
                <Input
                  id="pc-until"
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              激活
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={submitLoading || !form.code.trim() || !form.value}
            >
              {submitLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Stats Dialog */}
      <Dialog open={usageOpen} onOpenChange={(open) => { if (!open) closeUsage(); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>使用统计</DialogTitle>
            <DialogDescription>促销码使用情况</DialogDescription>
          </DialogHeader>
          {usageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usageStats ? (
            <div className="space-y-3">
              <StatRow label="总使用次数" value={usageStats.totalUses} />
              <StatRow label="折扣总额" value={`¥${usageStats.totalDiscountAmount.toFixed(2)}`} />
              {usageStats.maxUses !== undefined && usageStats.maxUses !== null && (
                <StatRow label="最大使用次数" value={usageStats.maxUses} />
              )}
              {usageStats.remainingUses !== undefined && usageStats.remainingUses !== null && (
                <StatRow label="剩余使用次数" value={usageStats.remainingUses} />
              )}
              <div className="flex items-center gap-2 pt-2">
                <Badge variant={usageStats.isExhausted ? 'destructive' : 'brand'}>
                  {usageStats.isExhausted ? '已用完' : '可用'}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">暂无数据</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeUsage}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}
