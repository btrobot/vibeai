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

interface DashboardStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  usedCredits: number;
  recentTasks: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
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

        const [projectsRes, tasksRes] = await Promise.all([
          fetch('/api/projects', {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch('/api/tasks?pageSize=5', {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
        ]);

        const projects = await projectsRes.json();
        const tasks = await tasksRes.json();

        setStats({
          totalProjects: projects?.total ?? 0,
          totalTasks: tasks?.total ?? 0,
          completedTasks: tasks?.items?.filter((t: any) => t.status === 'completed').length ?? 0,
          usedCredits: 0,
          recentTasks: (tasks?.items ?? []).slice(0, 5),
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
    { label: '任务总数', value: stats?.totalTasks ?? 0, icon: Image, color: 'text-foreground' },
    { label: '已完成', value: stats?.completedTasks ?? 0, icon: TrendingUp, color: 'text-brand' },
    { label: '可用额度', value: user?.credits ?? 0, icon: Sparkles, color: 'text-foreground' },
  ];

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '排队中', color: 'text-muted-foreground' },
    processing: { label: '处理中', color: 'text-primary' },
    completed: { label: '已完成', color: 'text-brand' },
    failed: { label: '失败', color: 'text-destructive' },
    cancelled: { label: '已取消', color: 'text-muted-foreground' },
  };

  const typeLabels: Record<string, string> = {
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
          <h1 className="text-xl font-bold text-foreground">欢迎回来，{user?.name || '用户'}</h1>
          <p className="text-sm text-muted-foreground mt-1">这是你的创作概览</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建项目
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-border bg-card p-4">
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

      {/* Recent Tasks */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">最近任务</h2>
          <button
            onClick={() => navigate('/projects')}
            className="text-xs text-primary hover:text-primary/80"
          >
            查看全部
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : !stats?.recentTasks?.length ? (
          <div className="flex flex-col items-center gap-2 p-8">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无任务</p>
            <button
              onClick={() => navigate('/tools/background-removal')}
              className="text-xs text-primary hover:text-primary/80"
            >
              开始创作
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.recentTasks.map((task) => {
              const status = statusLabels[task.status] || { label: task.status, color: 'text-muted-foreground' };
              const type = typeLabels[task.type] || task.type;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-surface-hover"
                >
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                  {task.status === 'processing' && (
                    <div className="h-1.5 w-20 rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
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