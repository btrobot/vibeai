import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderKanban,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

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

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const getAuthHeaders = (): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const fetchProjects = async () => {
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '12' });
      if (search) query.set('search', search);
      if (statusFilter !== 'all') query.set('status', statusFilter);

      const res = await fetch(`/api/projects?${query.toString()}`, {
        headers: { ...getAuthHeaders() },
      });
      const result = await res.json();
      if (res.ok) {
        const data = result.data ?? result;
        setProjects(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [page, statusFilter]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
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
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) fetchProjects();
    } catch {
      // Silently fail
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
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
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="pl-10"
          />
        </form>
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
      </div>

      {/* Project Grid */}
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
        <EmptyState
          icon={FolderKanban}
          title="暂无项目"
          description="创建你的第一个项目，开始 AI 创作之旅"
          action={{ label: '创建第一个项目', onClick: () => setShowNewModal(true) }}
        />
      ) : (
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
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {project.completedCreates}/{project.totalCreates}
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
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: Math.ceil(total / 12) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                page === i + 1
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
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
