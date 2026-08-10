import { useState, useMemo } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Pin, PinOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import type { Announcement, AnnouncementType } from './types';
import { formatDateTime } from './types';
import { useAdminCrud } from '@/hooks/useAdminCrud';

const TYPE_LABELS: Record<AnnouncementType, string> = {
  info: '通知',
  warning: '警告',
  maintenance: '维护',
};

interface FormState {
  title: string;
  content: string;
  type: AnnouncementType;
  isActive: boolean;
  isPinned: boolean;
  scheduledAt: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  type: 'info',
  isActive: true,
  isPinned: false,
  scheduledAt: '',
  expiresAt: '',
};

export default function AnnouncementTab() {
  const [typeFilter, setTypeFilter] = useState<'all' | AnnouncementType>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);

  const filterParams = useMemo<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (typeFilter !== 'all') params.type = typeFilter;
    return params;
  }, [typeFilter]);

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
  } = useAdminCrud<Announcement>({
    endpoint: '/api/announcements',
    pageSizeParam: 'limit',
    extractPagination: (res) => {
      const r = res as Record<string, unknown>;
      const pg = r.pagination as Record<string, number> | undefined;
      return { total: pg?.total ?? 0, totalPages: pg?.totalPages ?? 1 };
    },
    filterParams,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      type: item.type,
      isActive: item.isActive,
      isPinned: item.isPinned,
      scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : '',
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 16) : '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        isActive: form.isActive,
        isPinned: form.isPinned,
      };
      if (form.scheduledAt) body.scheduledAt = new Date(form.scheduledAt).toISOString();
      else body.scheduledAt = null;
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
      else body.expiresAt = null;

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
    if (!confirm('确定要删除此公告吗？')) return;
    setActionLoading(`del-${id}`);
    try {
      await remove(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePin = async (item: Announcement) => {
    setActionLoading(`pin-${item.id}`);
    try {
      await update(item.id, { isPinned: !item.isPinned });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">类型筛选</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'all' | AnnouncementType);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部</option>
            <option value="info">通知</option>
            <option value="warning">警告</option>
            <option value="maintenance">维护</option>
          </select>
        </div>
        <Button variant="brand" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建公告
        </Button>
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="暂无公告"
          description="点击「新建公告」创建第一条公告"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">标题</th>
                <th className="p-3 text-left font-medium text-muted-foreground">类型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-left font-medium text-muted-foreground">置顶</th>
                <th className="p-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3 max-w-xs truncate text-foreground">{item.title}</td>
                  <td className="p-3">
                    <Badge variant={item.type === 'warning' ? 'warning' : item.type === 'maintenance' ? 'destructive' : 'default'}>
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={item.isActive ? 'brand' : 'default'}>
                      {item.isActive ? '激活' : '停用'}
                    </Badge>
                  </td>
                  <td className="p-3">{item.isPinned ? <Badge variant="primary">置顶</Badge> : '-'}</td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(item)}
                        disabled={actionLoading === `pin-${item.id}`}
                        title={item.isPinned ? '取消置顶' : '置顶'}
                      >
                        {actionLoading === `pin-${item.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : item.isPinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
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

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-border">
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑公告' : '新建公告'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改公告内容和设置' : '创建新的系统公告'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">标题</Label>
              <Input
                id="ann-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="请输入公告标题"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-content">内容</Label>
              <Textarea
                id="ann-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="请输入公告内容"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ann-type">类型</Label>
                <select
                  id="ann-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as AnnouncementType })}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="maintenance">维护</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <div className="flex h-10 items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    激活
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    置顶
                  </label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ann-scheduled">定时发布（可选）</Label>
                <Input
                  id="ann-scheduled"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-expires">过期时间（可选）</Label>
                <Input
                  id="ann-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={submitLoading || !form.title.trim() || !form.content.trim()}
            >
              {submitLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
