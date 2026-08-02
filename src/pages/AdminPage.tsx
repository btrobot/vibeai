import { useState } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Settings,
  Activity,
  UserCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  totalStorage: number;
  activeUsers: number;
  failedTasks: number;
  recentActivity: Array<{
    id: string;
    type: string;
    userEmail: string;
    action: string;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <AlertTriangle className="h-12 w-12 text-muted" />
        <h2 className="text-lg font-semibold text-foreground">无权限访问</h2>
        <p className="text-sm text-muted">仅管理员可访问此页面</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">管理后台</h1>
          <p className="text-sm text-muted mt-1">系统监控与配置管理</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: '总用户', value: stats?.totalUsers ?? '-', icon: Users, color: 'text-blue-500' },
          { label: '活跃用户', value: stats?.activeUsers ?? '-', icon: UserCheck, color: 'text-green-500' },
          { label: '总项目', value: stats?.totalProjects ?? '-', icon: FileText, color: 'text-emerald-500' },
          { label: '总任务', value: stats?.totalTasks ?? '-', icon: Activity, color: 'text-purple-500' },
          { label: '失败任务', value: stats?.failedTasks ?? '-', icon: AlertTriangle, color: 'text-red-500' },
          { label: '存储用量', value: stats?.totalStorage ? `${(stats.totalStorage / 1024 / 1024).toFixed(1)}MB` : '-', icon: BarChart3, color: 'text-amber-500' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Management Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">用户管理</h2>
          <p className="text-sm text-muted">用户列表、权限管理、账户操作</p>
          <button className="mt-3 text-xs text-emerald-500 hover:text-emerald-400">
            查看用户列表 →
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">系统配置</h2>
          <p className="text-sm text-muted">AI 模型配置、存储设置、计费参数</p>
          <button className="mt-3 text-xs text-emerald-500 hover:text-emerald-400">
            系统配置 →
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">任务监控</h2>
          <p className="text-sm text-muted">实时任务队列、失败任务排查、性能监控</p>
          <button className="mt-3 text-xs text-emerald-500 hover:text-emerald-400">
            查看任务 →
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">审计日志</h2>
          <p className="text-sm text-muted">操作日志、登录记录、安全事件</p>
          <button className="mt-3 text-xs text-emerald-500 hover:text-emerald-400">
            查看日志 →
          </button>
        </div>
      </div>
    </div>
  );
}