import { useState, useMemo } from 'react';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { SystemSetting, SettingCategory } from './types';
import { getAuthHeaders, formatDateTime } from './types';
import { useAdminCrud } from '@/hooks/useAdminCrud';

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  homepage: '首页',
  seo: 'SEO',
  feature: '功能',
  general: '通用',
};

interface FormState {
  key: string;
  value: string;
  category: SettingCategory;
  description: string;
  isPublic: boolean;
}

const EMPTY_FORM: FormState = {
  key: '',
  value: '{}',
  category: 'general',
  description: '',
  isPublic: false,
};

export default function SystemConfigTab() {
  const [categoryFilter, setCategoryFilter] = useState<'all' | SettingCategory>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const filterParams = useMemo<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (categoryFilter !== 'all') params.category = categoryFilter;
    return params;
  }, [categoryFilter]);

  const {
    items,
    loading,
    setItems,
    patchItem,
    removeVia,
  } = useAdminCrud<SystemSetting>({
    endpoint: '/api/system-config',
    paginated: false,
    filterParams,
  });

  const openCreate = () => {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setJsonError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: SystemSetting) => {
    setEditingKey(item.key);
    setForm({
      key: item.key,
      value: JSON.stringify(item.value, null, 2),
      category: item.category,
      description: item.description ?? '',
      isPublic: item.isPublic,
    });
    setJsonError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.key.trim()) return;
    let parsedValue: Record<string, unknown>;
    try {
      parsedValue = JSON.parse(form.value);
      setJsonError(null);
    } catch {
      setJsonError('JSON 格式无效');
      return;
    }
    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
        key: form.key.trim(),
        value: parsedValue,
        category: form.category,
        description: form.description.trim() || undefined,
        isPublic: form.isPublic,
      };

      if (editingKey) {
        // Edit: optimistically update existing item, POST upsert, rollback on failure
        const existing = items.find((i) => i.key === editingKey);
        if (existing) {
          await patchItem(
            existing.id,
            (item) => ({
              ...item,
              value: parsedValue,
              category: form.category,
              description: form.description.trim() || null,
              isPublic: form.isPublic,
            }),
            async () => {
              const res = await fetch('/api/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body),
              });
              return res.ok;
            },
          );
        }
      } else {
        // Create: POST and insert returned item at head (no full refetch)
        const res = await fetch('/api/system-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const json = await res.json();
          const created = json.data ?? json;
          if (created) {
            setItems((prev) => [created as SystemSetting, ...prev]);
          }
        }
      }
      setDialogOpen(false);
    } catch {
      // ignore
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (item: SystemSetting) => {
    if (!confirm(`确定要删除配置「${item.key}」吗？`)) return;
    setActionLoading(`del-${item.key}`);
    try {
      await removeVia(item.id, async () => {
        const res = await fetch(`/api/system-config/${encodeURIComponent(item.key)}`, {
          method: 'DELETE',
          headers: { ...getAuthHeaders() },
        });
        return res.ok;
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">分类筛选</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | SettingCategory)}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部分类</option>
            <option value="homepage">首页</option>
            <option value="seo">SEO</option>
            <option value="feature">功能</option>
            <option value="general">通用</option>
          </select>
        </div>
        <Button variant="brand" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建配置
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Settings} title="暂无配置" description="点击「新建配置」创建第一个系统配置" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">键</th>
                <th className="p-3 text-left font-medium text-muted-foreground">分类</th>
                <th className="p-3 text-left font-medium text-muted-foreground">值</th>
                <th className="p-3 text-left font-medium text-muted-foreground">公开</th>
                <th className="p-3 text-left font-medium text-muted-foreground">更新时间</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3 font-mono text-xs text-foreground">{item.key}</td>
                  <td className="p-3">
                    <Badge variant="default">{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                  </td>
                  <td className="p-3 max-w-xs truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(item.value)}
                  </td>
                  <td className="p-3">
                    <Badge variant={item.isPublic ? 'brand' : 'default'}>
                      {item.isPublic ? '公开' : '私有'}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(item.updatedAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title="编辑">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        disabled={actionLoading === `del-${item.key}`}
                        title="删除"
                      >
                        {actionLoading === `del-${item.key}` ? (
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
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingKey ? '编辑配置' : '新建配置'}</DialogTitle>
            <DialogDescription>
              {editingKey ? '修改系统配置' : '创建新的系统配置项'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-key">配置键</Label>
              <Input
                id="cfg-key"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="如 homepage.carousel"
                disabled={!!editingKey}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-value">配置值（JSON）</Label>
              <Textarea
                id="cfg-value"
                value={form.value}
                onChange={(e) => {
                  setForm({ ...form, value: e.target.value });
                  setJsonError(null);
                }}
                placeholder='{"key": "value"}'
                rows={5}
                className="font-mono text-xs"
              />
              {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cfg-category">分类</Label>
                <select
                  id="cfg-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as SettingCategory })}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="homepage">首页</option>
                  <option value="seo">SEO</option>
                  <option value="feature">功能</option>
                  <option value="general">通用</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfg-desc">描述</Label>
                <Input
                  id="cfg-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="配置描述（可选）"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              允许未登录用户读取
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={submitLoading || !form.key.trim()}
            >
              {submitLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editingKey ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
