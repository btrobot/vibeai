import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderKanban,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  Filter,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/apiClient';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  tags: string[];
  coverUrl: string | null;
  totalCreates: number;
  completedCreates: number;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 12;
const VIEW_KEY = 'project_view';

type ViewMode = 'card' | 'list';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card',
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  // 请求序号防竞态：忽略过期响应（与 AbortController 行为等价，兼容 jsdom+MSW 测试环境）
  const requestSeqRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = search.trim() !== '' || statusFilter !== 'all';

  // 搜索防抖：停止输入 300ms 后触发查询
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 搜索词 / 状态筛选变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // 卸载时使未完成的请求失效
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
    };
  }, []);

  const fetchProjects = async () => {
    const seq = ++requestSeqRef.current;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (statusFilter !== 'all') query.set('status', statusFilter);

    try {
      const res = await apiFetch(`/api/projects?${query.toString()}`);
      if (res.ok) {
        const result = await res.json();
        const data = result.data ?? result;
        if (seq !== requestSeqRef.current) return; // 已有更新的请求，丢弃本次结果
        setProjects(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // 网络异常，静默处理
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter]);

  // 记忆视图偏好
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewName('');
        setNewDesc('');
        fetchProjects();
      }
    } catch {
      // Silently fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此项目？此操作不可恢复。')) return;
    try {
      const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProjects();
    } catch {
      // Silently fail
    }
  };

  const statusVariant: Record<string, 'primary' | 'brand' | 'default'> = {
    active: 'primary',
    completed: 'brand',
    archived: 'default',
  };

  const statusLabels: Record<string, string> = {
    active: '进行中',
    completed: '已完成',
    archived: '已归档',
  };

  const renderCardGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
          <div
            className="cursor-pointer p-4"
            onClick={() => navigate(`/workspace/${project.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <Badge variant={statusVariant[project.status] || 'default'}>
                {statusLabels[project.status] || project.status}
              </Badge>
            </div>

            <h3 className="text-base font-medium text-foreground mb-1 truncate">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span
                className="flex items-center gap-1"
                title={`已完成 ${project.completedCreates} / 共 ${project.totalCreates} 个创作`}
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {project.completedCreates}/{project.totalCreates} 创作
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 border-t border-border px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => navigate(`/workspace/${project.id}`)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              aria-label="打开项目"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(project.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-destructive"
              aria-label="删除项目"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover"
          onClick={() => navigate(`/workspace/${project.id}`)}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-4 w-4 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium text-foreground">{project.name}</h3>
              <Badge variant={statusVariant[project.status] || 'default'}>
                {statusLabels[project.status] || project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.description}</p>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {project.completedCreates}/{project.totalCreates}
          </div>

          <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/workspace/${project.id}`);
              }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              aria-label="打开项目"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(project.id);
              }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-destructive"
              aria-label="删除项目"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">我的项目</h1>
          <p className="text-sm text-muted-foreground mt-1">共 {total} 个项目</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          新建项目
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {['all', 'active', 'completed', 'archived'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? '全部' : statusLabels[s] || s}
              </button>
            ))}
          </div>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1" role="group" aria-label="视图切换">
            <button
              onClick={() => setView('card')}
              aria-label="卡片视图"
              aria-pressed={view === 'card'}
              className={`rounded-md p-1.5 transition-colors ${
                view === 'card'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label="列表视图"
              aria-pressed={view === 'list'}
              className={`rounded-md p-1.5 transition-colors ${
                view === 'list'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Project Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-14 rounded" />
              </div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={Search}
            title="无匹配项目"
            description="试试调整搜索关键词或状态筛选条件"
            action={{
              label: '清除筛选',
              onClick: () => {
                setSearch('');
                setStatusFilter('all');
              },
            }}
          />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="暂无项目"
            description="创建你的第一个项目，开始 AI 创作之旅"
            action={{ label: '创建第一个项目', onClick: () => setShowNewModal(true) }}
          />
        )
      ) : view === 'card' ? (
        renderCardGrid()
      ) : (
        renderList()
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </Button>
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-base font-semibold text-foreground mb-4">新建项目</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">项目名称 <span className="text-destructive">*</span></Label>
                <Input
                  id="project-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入项目名称"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">描述（可选）</Label>
                <textarea
                  id="project-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="项目描述"
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowNewModal(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                创建
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
