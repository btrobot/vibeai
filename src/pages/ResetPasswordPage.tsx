import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setResult({ type: 'error', text: '缺少重置令牌' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResult({ type: 'error', text: '两次密码不一致' });
      return;
    }
    if (newPassword.length < 8) {
      setResult({ type: 'error', text: '密码至少 8 位' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ type: 'success', text: data.message || '密码已重置' });
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      } else {
        setResult({ type: 'error', text: data.message || '重置失败，请重试' });
      }
    } catch {
      setResult({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5 pointer-events-none" />
      <Card className="w-full max-w-md relative z-10 border-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">重置密码</CardTitle>
          <CardDescription>设置你的新密码</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {result && (
              <div
                className={`rounded-lg border p-4 text-sm ${
                  result.type === 'success'
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-destructive/20 bg-destructive/10 text-destructive'
                }`}
                role="alert"
              >
                <div className="flex items-start gap-2">
                  {result.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span>{result.text}</span>
                </div>
              </div>
            )}

            {!tokenFromUrl && (
              <div className="space-y-2">
                <Label htmlFor="token">重置令牌</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="输入重置令牌"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">至少 8 位，包含字母和数字</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !token || !newPassword || !confirmPassword}>
              {loading ? '正在重置...' : '重置密码'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center border-t border-border pt-4">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            返回登录
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
