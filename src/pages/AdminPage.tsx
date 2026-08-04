import { useState } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Activity,
  UserCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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

  const getAuthHeaders = (): Record<string, string> => {
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
        const result = await res.json();
        setStats(result.data ?? result);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="无权限访问"
          description="仅管理员可访问此页面"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">管理后台</h1>
          <p className="text-sm text-muted-foreground mt-1">系统监控与配置管理</p>
        </div>
        <Button variant="outline" onClick={fetchStats}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: '总用户', value: stats?.totalUsers ?? '-', icon: Users, color: 'text-primary' },
          { label: '活跃用户', value: stats?.activeUsers ?? '-', icon: UserCheck, color: 'text-brand' },
          { label: '总项目', value: stats?.totalProjects ?? '-', icon: FileText, color: 'text-foreground' },
          { label: '总任务', value: stats?.totalTasks ?? '-', icon: Activity, color: 'text-primary' },
          { label: '失败任务', value: stats?.failedTasks ?? '-', icon: AlertTriangle, color: 'text-destructive' },
          { label: '存储用量', value: stats?.totalStorage ? `${(stats.totalStorage / 1024 / 1024).toFixed(1)}MB` : '-', icon: BarChart3, color: 'text-muted-foreground' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-4"
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
        ))}
      </div>

      {/* Management Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: '用户管理', desc: '用户列表、权限管理、账户操作', action: '查看用户列表' },
          { title: '系统配置', desc: 'AI 模型配置、存储设置、计费参数', action: '系统配置' },
          { title: '任务监控', desc: '实时任务队列、失败任务排查、性能监控', action: '查看任务' },
          { title: '审计日志', desc: '操作日志、登录记录、安全事件', action: '查看日志' },
        ].map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.desc}</p>
            <Button variant="link" size="sm" className="mt-3 p-0">
              {section.action} →
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
