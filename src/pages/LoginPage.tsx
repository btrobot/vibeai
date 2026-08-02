import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, setError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.password) {
      setError('请填写所有字段');
      return;
    }

    const result = await login(form);
    if (result.success) {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5 pointer-events-none" />
      <Card className="w-full max-w-md relative z-10 border-border/50">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
          <CardDescription>登录你的 VibeAI 账户</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  忘记密码？
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center border-t border-border/50 pt-4">
          <p className="text-sm text-muted-foreground">
            还没有账户？{' '}
            <Link to="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">
              立即注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}