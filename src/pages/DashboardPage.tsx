import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Image,
  Video,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface DashboardStats {
  totalProjects: number;
  totalCreates: number;
  completedCreates: number;
  usedCredits: number;
  recentCreates: Array<{
    id: string;
    capabilitySlug: string;
    status: string;
    taskProgress: number;
    prompt: string;
    createdAt: string;
    projectId: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stored = localStorage.getItem('auth_tokens');
        const tokens = stored ? JSON.parse(stored) : null;
        if (!tokens?.accessToken) return;

        const [projectsRes, createsRes] = await Promise.all([
          fetch('/api/projects', {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch('/api/creates?pageSize=5', {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
        ]);

        const projects = await projectsRes.json();
        const createsData = await createsRes.json();
        const createItems = createsData?.items ?? createsData?.data?.items ?? [];

        setStats({
          totalProjects: projects?.total ?? projects?.data?.total ?? 0,
          totalCreates: createsData?.total ?? createsData?.data?.total ?? 0,
          completedCreates: createItems.filter((c: { status: string }) => c.status === 'completed').length,
          usedCredits: (user?.credits !== undefined) ? Math.max(0, 100 - user.credits) : 0,
          recentCreates: createItems.slice(0, 5),
        });
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: '项目总数', value: stats?.totalProjects ?? 0, icon: FolderKanban, color: 'text-primary' },
    { label: '创作总数', value: stats?.totalCreates ?? 0, icon: Image, color: 'text-foreground' },
    { label: '已完成', value: stats?.completedCreates ?? 0, icon: TrendingUp, color: 'text-brand' },
    { label: '可用额度', value: user?.credits ?? 0, icon: Sparkles, color: 'text-foreground' },
  ];

  const statusConfig: Record<string, { label: string; variant: 'default' | 'primary' | 'brand' | 'warning' | 'destructive' }> = {
    draft: { label: '草稿', variant: 'default' },
    processing: { label: '生成中...', variant: 'primary' },
    completed: { label: '已完成', variant: 'brand' },
    failed: { label: '生成失败', variant: 'destructive' },
    cancelled: { label: '已取消', variant: 'default' },
  };

  const capabilityLabels: Record<string, string> = {
    'text-generation': '文本生成',
    'image-generation': '图像生成',
    'video-generation': '视频生成',
    'background-removal': '白底图',
    'scene-composition': '场景合成',
    'model-dressing': '模特换装',
    'detail-page-generation': '详情页生成',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">欢迎回来，{user?.name || '用户'}</h1>
          <p className="text-sm text-muted-foreground mt-1">这是你的创作概览</p>
        </div>
        <Button onClick={() => navigate('/projects')}>
          <Plus className="h-4 w-4" />
          新建项目
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </div>
          ))
        ) : (
          statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold font-mono text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">快速创作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '白底图生成', icon: Image, path: '/tools/background-removal' },
            { label: '场景合成', icon: Sparkles, path: '/tools/scene-composition' },
            { label: '模特换装', icon: Image, path: '/tools/model-dressing' },
            { label: '视频生成', icon: Video, path: '/tools/detail-page' },
          ].map((tool) => (
            <button
              key={tool.label}
              onClick={() => navigate(tool.path)}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-surface-hover"
            >
              <tool.icon className="h-4 w-4 text-primary" />
              <span>{tool.label}</span>
              <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Recent Creates */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">最近创作</h2>
          <Button variant="link" size="sm" onClick={() => navigate('/projects')}>
            查看全部
          </Button>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : !stats?.recentCreates?.length ? (
          <EmptyState
            icon={AlertCircle}
            title="暂无创作"
            description="开始你的第一次创作吧"
            action={{ label: '开始创作', onClick: () => navigate('/projects') }}
            className="py-12"
          />
        ) : (
          <div className="divide-y divide-border">
            {stats.recentCreates.map((create) => {
              const status = statusConfig[create.status] || { label: create.status, variant: 'default' as const };
              const capLabel = capabilityLabels[create.capabilitySlug] || create.capabilitySlug;
              return (
                <div
                  key={create.id}
                  className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-surface-hover"
                >
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{capLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">{create.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(create.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {create.status === 'processing' && (
                    <div className="w-20">
                      <Progress value={create.taskProgress} size="slim" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
