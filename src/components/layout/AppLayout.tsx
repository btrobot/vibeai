import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Image,
  Video,
  ShieldCheck,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Store,
  Palette,
  Shirt,
  FileText,
  Film,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const sidebarNav = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/projects', label: '我的项目', icon: FolderKanban },
  {
    label: '电商工具',
    icon: Store,
    children: [
      { to: '/tools/background-removal', label: '白底图生成', icon: ShieldCheck },
      { to: '/tools/scene-composition', label: '场景合成', icon: Palette },
      { to: '/tools/model-dressing', label: '模特换装', icon: Shirt },
      { to: '/tools/detail-page', label: '详情页生成', icon: FileText },
    ],
  },
  { to: '/gallery', label: '社区画廊', icon: Image },
  { to: '/settings', label: '设置', icon: Settings },
  { to: '/admin', label: '管理后台', icon: Users },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col border-r border-border bg-surface
          transition-all duration-300
          ${sidebarCollapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/20">
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-foreground">VibeAI</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {sidebarNav.map((item) => {
            if ('children' in item && item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setToolsOpen(!toolsOpen)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground ${
                      sidebarCollapsed ? 'justify-center' : ''
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight
                          className={`h-3 w-3 transition-transform ${
                            toolsOpen ? 'rotate-90' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>
                  {toolsOpen && !sidebarCollapsed && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-emerald-600/10 text-emerald-500'
                                : 'text-muted hover:bg-surface-hover hover:text-foreground'
                            }`
                          }
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-600/10 text-emerald-500'
                      : 'text-muted hover:bg-surface-hover hover:text-foreground'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-2">
          <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-medium text-emerald-500">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name || '用户'}</p>
                <p className="text-xs text-muted truncate">{user?.email || ''}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-danger ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title="退出登录"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileOpen(!mobileOpen);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
          >
            {window.innerWidth < 768 ? (
              mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />
            ) : sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1" />

          {/* Credits Badge */}
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-foreground">{user?.credits ?? 0}</span>
            <span className="text-xs text-muted">额度</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}