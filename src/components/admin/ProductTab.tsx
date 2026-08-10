import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
import type { Product, ProductCategory, ProductStatus } from './types';
import { getAuthHeaders, formatDate } from './types';
import { useAdminCrud } from '@/hooks/useAdminCrud';

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: '草稿',
  active: '上架',
  archived: '归档',
};

const STATUS_VARIANT: Record<ProductStatus, 'default' | 'brand' | 'warning'> = {
  draft: 'default',
  active: 'brand',
  archived: 'warning',
};

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  status: ProductStatus;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  categoryId: '',
  status: 'draft',
};

export default function ProductTab() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);

  const filterParams = useMemo<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (categoryFilter !== 'all') params.categoryId = categoryFilter;
    return params;
  }, [categoryFilter]);

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
  } = useAdminCrud<Product>({
    endpoint: '/api/admin/commerce/products',
    filterParams,
  });

  // ===== Categories fetch (with AbortController) =====
  const catAbortRef = useRef<AbortController | null>(null);
  const fetchCategories = useCallback(async () => {
    catAbortRef.current?.abort();
    const controller = new AbortController();
    catAbortRef.current = controller;
    try {
      const res = await fetch('/api/admin/commerce/categories?pageSize=100', {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) return;
      if (controller.signal.aborted) return;
      const result = await res.json();
      if (controller.signal.aborted) return;
      const data = result.data ?? result;
      setCategories(data.items ?? data ?? []);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    return () => catAbortRef.current?.abort();
  }, [fetchCategories]);

  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? '-') : '-';

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? '' });
    setDialogOpen(true);
  };

  const openEdit = (item: Product) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      categoryId: item.categoryId ?? '',
      status: item.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.categoryId) return;
    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId,
        images: [],
        status: form.status,
      };
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
    if (!confirm('确定要删除此商品吗？')) return;
    setActionLoading(`del-${id}`);
    try {
      await remove(id);
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
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Button variant="brand" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建商品
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="暂无商品" description="点击「新建商品」创建第一个商品" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30">
                <th className="p-3 text-left font-medium text-muted-foreground">名称</th>
                <th className="p-3 text-left font-medium text-muted-foreground">分类</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3 max-w-xs truncate text-foreground">{item.name}</td>
                  <td className="p-3 text-muted-foreground">{categoryName(item.categoryId)}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑商品' : '新建商品'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改商品信息' : '创建新商品'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prod-name">商品名称</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入商品名称"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-desc">描述</Label>
              <Textarea
                id="prod-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="商品描述（可选）"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-cat">分类</Label>
                <select
                  id="prod-cat"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">请选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-status">状态</Label>
                <select
                  id="prod-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="draft">草稿</option>
                  <option value="active">上架</option>
                  <option value="archived">归档</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={submitLoading || !form.name.trim() || !form.categoryId}
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
