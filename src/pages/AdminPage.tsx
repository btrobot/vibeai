import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Activity,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Ban,
  ShieldCheck,
  ShieldOff,
  Trash2,
  EyeOff,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Crown,
  Download,
  Send,
  Megaphone,
  ShoppingCart,
  Package,
  Ticket as TicketIcon,
  Settings as SettingsIcon,
  ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useAuth } from '../hooks/useAuth';
import { NotificationDialog, AnnouncementTab, OrderTab, ProductTab, PromoCodeTab, SystemConfigTab, AuditLogTab } from '@/components/admin';
import { downloadFromUrl, getDownloadTimestamp } from '@/lib/download';

type Tab = 'dashboard' | 'users' | 'gallery' | 'announcements' | 'orders' | 'products' | 'promoCodes' | 'systemConfig' | 'auditLogs';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalProjects: number;
  totalTasks: number;
  failedTasks: number;
  totalStorage: number;
  totalGalleryWorks: number;
  publishedGalleryWorks: number;
  totalCreditsInCirculation: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  credits: number;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface GalleryWork {
  id: string;
  userId: string;
  title: string | null;
  type: string;
  prompt: string | null;
  modelSlug: string | null;
  isPublished: boolean;
  likes: number;
  views: number;
  createdAt: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'dashboard', label: '数据看板', icon: BarChart3 },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'gallery', label: '内容审核', icon: ImageIcon },
  { id: 'announcements', label: '公告管理', icon: Megaphone },
  { id: 'orders', label: '订单管理', icon: ShoppingCart },
  { id: 'products', label: '商品管理', icon: Package },
  { id: 'promoCodes', label: '促销码', icon: TicketIcon },
  { id: 'systemConfig', label: '系统配置', icon: SettingsIcon },
  { id: 'auditLogs', label: '审计日志', icon: ScrollText },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [broadcastMode, setBroadcastMode] = useState(false);

  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const [works, setWorks] = useState<GalleryWork[]>([]);
  const [worksPage, setWorksPage] = useState(1);
  const [worksTotal, setWorksTotal] = useState(0);
  const [worksTotalPages, setWorksTotalPages] = useState(1);

  const PAGE_SIZE = 10;

  const getAuthHeaders = (): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', { headers: { ...getAuthHeaders() } });
      if (res.ok) {
        const result = await res.json();
        setStats(result.data ?? result);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (page: number, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`, { headers: { ...getAuthHeaders() } });
      if (res.ok) {
        const result = await res.json();
        const data = result.data ?? result;
        setUsers(data.users ?? []);
        setUsersTotal(data.total ?? 0);
        setUsersTotalPages(data.totalPages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorks = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      const res = await fetch(`/api/admin/gallery?${params}`, { headers: { ...getAuthHeaders() } });
      if (res.ok) {
        const result = await res.json();
        const data = result.data ?? result;
        setWorks(data.works ?? []);
        setWorksTotal(data.total ?? 0);
        setWorksTotalPages(data.totalPages ?? 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (activeTab === 'dashboard') fetchStats();
    else if (activeTab === 'users') fetchUsers(usersPage, usersSearch);
    else if (activeTab === 'gallery') fetchWorks(worksPage);
  }, [activeTab, user?.role, usersPage, worksPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search - trigger search 500ms after user stops typing
  useEffect(() => {
    if (activeTab !== 'users') return;

    const timeoutId = setTimeout(() => {
      if (usersSearch !== '') {
        setUsersPage(1);
        fetchUsers(1, usersSearch);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [usersSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBanUser = async (userId: string) => {
    setActionLoading(`ban-${userId}`);
    try {
      await fetch(`/api/admin/users/${userId}/ban`, { method: 'PATCH', headers: { ...getAuthHeaders() } });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: false } : u)));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    setActionLoading(`unban-${userId}`);
    try {
      await fetch(`/api/admin/users/${userId}/unban`, { method: 'PATCH', headers: { ...getAuthHeaders() } });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: true } : u)));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(`role-${userId}`);
    try {
      await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublishWork = async (workId: string) => {
    setActionLoading(`unpub-${workId}`);
    try {
      await fetch(`/api/admin/gallery/${workId}/unpublish`, { method: 'PATCH', headers: { ...getAuthHeaders() } });
      setWorks((prev) => prev.map((w) => (w.id === workId ? { ...w, isPublished: false } : w)));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishWork = async (workId: string) => {
    setActionLoading(`pub-${workId}`);
    try {
      await fetch(`/api/gallery/works/${workId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ isFeatured: false }),
      });
      setWorks((prev) => prev.map((w) => (w.id === workId ? { ...w, isPublished: true } : w)));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWork = async (workId: string) => {
    if (!confirm('确认删除此作品？此操作不可恢复。')) return;
    setActionLoading(`del-${workId}`);
    try {
      await fetch(`/api/admin/gallery/${workId}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      setWorks((prev) => prev.filter((w) => w.id !== workId));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = () => {
    setUsersPage(1);
    fetchUsers(1, usersSearch);
  };

  const handleNotifyUser = (userId: string, userEmail: string) => {
    setSelectedUserId(userId);
    setSelectedUserEmail(userEmail);
    setBroadcastMode(false);
    setShowNotificationDialog(true);
  };

  const handleBroadcastNotification = () => {
    setSelectedUserId(null);
    setSelectedUserEmail(null);
    setBroadcastMode(true);
    setShowNotificationDialog(true);
  };

  const handleExportUsers = async () => {
    setExportLoading('users');
    try {
      const filename = `users-${getDownloadTimestamp()}.csv`;
      await downloadFromUrl('/api/admin/users/export', filename, {
        headers: { ...getAuthHeaders() },
      });
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExportLoading(null);
    }
  };

  const handleExportGallery = async () => {
    setExportLoading('gallery');
    try {
      const filename = `gallery-${getDownloadTimestamp()}.csv`;
      await downloadFromUrl('/api/admin/gallery/export', filename, {
        headers: { ...getAuthHeaders() },
      });
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExportLoading(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} title="无权限访问" description="仅管理员可访问此页面" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">管理后台</h1>
          <p className="text-sm text-muted-foreground mt-1">系统监控、用户管理与内容审核</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (activeTab === 'dashboard') fetchStats();
            else if (activeTab === 'users') fetchUsers(usersPage, usersSearch);
            else fetchWorks(worksPage);
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '总用户', value: stats.totalUsers ?? 0, icon: Users, color: 'text-primary' },
              { label: '活跃用户', value: stats.activeUsers ?? 0, icon: UserCheck, color: 'text-brand' },
              { label: '封禁用户', value: stats.bannedUsers ?? 0, icon: Ban, color: 'text-destructive' },
              { label: '流通信用', value: stats.totalCreditsInCirculation ?? 0, icon: Crown, color: 'text-amber-600' },
              { label: '总项目', value: stats.totalProjects ?? 0, icon: FileText, color: 'text-foreground' },
              { label: '总任务', value: stats.totalTasks ?? 0, icon: Activity, color: 'text-primary' },
              { label: '失败任务', value: stats.failedTasks ?? 0, icon: AlertTriangle, color: 'text-destructive' },
              { label: '存储用量', value: formatBytes(stats.totalStorage ?? 0), icon: BarChart3, color: 'text-muted-foreground' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">画廊统计</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">{stats.totalGalleryWorks ?? 0}</p>
                  <p className="text-xs text-muted-foreground">作品总数</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-brand">{stats.publishedGalleryWorks ?? 0}</p>
                  <p className="text-xs text-muted-foreground">已发布</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">系统状态</h3>
              <div className="flex items-center gap-2">
                <div className="flex h-2 w-2 rounded-full bg-brand" />
                <span className="text-sm text-muted-foreground">所有服务运行正常</span>
              </div>
              <Button variant="link" size="sm" className="mt-2 p-0" onClick={() => window.open('/api/health/deep', '_blank')}>
                {'查看深度健康检查 ->'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Input
                placeholder="搜索用户邮箱或姓名..."
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
                搜索
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBroadcastNotification}>
                <Send className="h-4 w-4 mr-2" />
                群发通知
              </Button>
              <Button
                variant="outline"
                onClick={handleExportUsers}
                disabled={exportLoading === 'users'}
              >
                {exportLoading === 'users' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                导出用户
              </Button>
            </div>
          </div>

          {users.length === 0 && !loading ? (
            <EmptyState icon={Users} title="暂无用户" description="没有找到匹配的用户" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-hover">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">用户</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">角色</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">信用</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">注册时间</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{u.name || u.email}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {u.role === 'admin' ? (
                          <Badge variant="primary">
                            <Crown className="h-3 w-3 mr-1" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="default">用户</Badge>
                        )}
                      </td>
                      <td className="p-3 font-mono text-foreground">{u.credits}</td>
                      <td className="p-3">
                        {u.isActive ? (
                          <Badge variant="brand">活跃</Badge>
                        ) : (
                          <Badge variant="destructive">封禁</Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleNotifyUser(u.id, u.email)}
                            title="发送通知"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {u.role !== 'admin' && (
                            <>
                              {u.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBanUser(u.id)}
                                  disabled={actionLoading === `ban-${u.id}`}
                                >
                                  {actionLoading === `ban-${u.id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Ban className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnbanUser(u.id)}
                                  disabled={actionLoading === `unban-${u.id}`}
                                >
                                  {actionLoading === `unban-${u.id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRoleChange(u.id, 'admin')}
                                disabled={actionLoading === `role-${u.id}`}
                                title="提升为管理员"
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {u.role === 'admin' && u.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRoleChange(u.id, 'user')}
                              disabled={actionLoading === `role-${u.id}`}
                              title="降为普通用户"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  共 {usersTotal} 条
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    disabled={usersPage <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {usersPage} / {usersTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                    disabled={usersPage >= usersTotalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              onClick={handleExportGallery}
              disabled={exportLoading === 'gallery'}
            >
              {exportLoading === 'gallery' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              导出作品
            </Button>
          </div>

          {works.length === 0 && !loading ? (
            <EmptyState icon={ImageIcon} title="暂无作品" description="画廊中还没有作品" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-hover">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">标题</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">类型</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">模型</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">状态</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">点赞</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">创建时间</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map((w) => (
                    <tr key={w.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                      <td className="p-3 max-w-xs truncate text-foreground">
                        {w.title || w.prompt?.slice(0, 30) || '未命名'}
                      </td>
                      <td className="p-3">
                        <Badge variant={w.type === 'video' ? 'brand' : 'default'}>
                          {w.type === 'video' ? '视频' : '图片'}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{w.modelSlug || '-'}</td>
                      <td className="p-3">
                        {w.isPublished ? (
                          <Badge variant="brand">已发布</Badge>
                        ) : (
                          <Badge variant="default">未发布</Badge>
                        )}
                      </td>
                      <td className="p-3 font-mono text-foreground">{w.likes}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(w.createdAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {!w.isPublished && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishWork(w.id)}
                              disabled={actionLoading === `pub-${w.id}`}
                              title="发布到画廊"
                            >
                              {actionLoading === `pub-${w.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {w.isPublished && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnpublishWork(w.id)}
                              disabled={actionLoading === `unpub-${w.id}`}
                              title="下架"
                            >
                              {actionLoading === `unpub-${w.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWork(w.id)}
                            disabled={actionLoading === `del-${w.id}`}
                            title="删除"
                          >
                            {actionLoading === `del-${w.id}` ? (
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
                <span className="text-xs text-muted-foreground">共 {worksTotal} 条</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                    disabled={worksPage <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {worksPage} / {worksTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWorksPage((p) => Math.min(worksTotalPages, p + 1))}
                    disabled={worksPage >= worksTotalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announcement Tab */}
      {activeTab === 'announcements' && <AnnouncementTab />}

      {/* Orders Tab */}
      {activeTab === 'orders' && <OrderTab />}

      {/* Products Tab */}
      {activeTab === 'products' && <ProductTab />}

      {/* Promo Codes Tab */}
      {activeTab === 'promoCodes' && <PromoCodeTab />}

      {/* System Config Tab */}
      {activeTab === 'systemConfig' && <SystemConfigTab />}

      {/* Audit Logs Tab */}
      {activeTab === 'auditLogs' && <AuditLogTab />}

      {loading && activeTab === 'dashboard' && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Notification Dialog */}
      <NotificationDialog
        open={showNotificationDialog}
        onOpenChange={(open) => {
          setShowNotificationDialog(open);
          if (!open) {
            setSelectedUserId(null);
            setSelectedUserEmail(null);
            setBroadcastMode(false);
          }
        }}
        userId={selectedUserId || undefined}
        userEmail={selectedUserEmail || undefined}
        broadcastMode={broadcastMode}
        userCount={broadcastMode ? usersTotal : undefined}
        onSuccess={() => {
          if (activeTab === 'users') fetchUsers(usersPage, usersSearch);
        }}
      />
    </div>
  );
}
