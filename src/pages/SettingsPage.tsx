import { useState } from 'react';
import {
  User,
  Mail,
  Key,
  Bell,
  Palette,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function SettingsPage() {
  const { user, fetchUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = () => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '个人资料已更新' });
        fetchUser();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || data.message || '更新失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '更新失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次密码不一致' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '密码至少 6 位' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '密码已修改' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || data.message || '修改失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '修改失败' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">设置</h1>
        <p className="text-sm text-muted mt-1">管理你的账户和偏好</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-danger'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Profile */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10">
            <User className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">个人资料</h2>
            <p className="text-xs text-muted">更新你的个人信息</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground mb-1">邮箱</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Mail className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">{user?.email || ''}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-1">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10">
            <Key className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">修改密码</h2>
            <p className="text-xs text-muted">建议定期更换密码</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground mb-1">当前密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-foreground mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            修改密码
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10">
            <User className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">账户信息</h2>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">角色</span>
            <span className="text-foreground">{user?.role === 'admin' ? '管理员' : '用户'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">注册时间</span>
            <span className="text-foreground">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">可用额度</span>
            <span className="text-foreground font-medium text-emerald-500">{user?.credits ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}