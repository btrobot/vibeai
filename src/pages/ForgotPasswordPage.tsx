import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string; resetUrl?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          type: 'success',
          text: data.message || '重置链接已生成',
          resetUrl: data.data?.resetUrl,
        });
      } else {
        setResult({ type: 'error', text: data.message || '操作失败，请重试' });
      }
    } catch {
      setResult({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const copyResetUrl = () => {
    if (result?.resetUrl) {
      const fullUrl = `${window.location.origin}${result.resetUrl}`;
      navigator.clipboard.writeText(fullUrl);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5 pointer-events-none" />
      <Card className="w-full max-w-md relative z-10 border-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">忘记密码</CardTitle>
          <CardDescription>输入注册邮箱以获取密码重置链接</CardDescription>
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
                  <div className="flex-1">
                    <p>{result.text}</p>
                    {result.resetUrl && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          开发模式：点击下方链接直接重置密码
                        </p>
                        <div className="flex items-center gap-2">
                          <Link
                            to={result.resetUrl}
                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors underline"
                          >
                            前往重置密码
                          </Link>
                          <button
                            type="button"
                            onClick={copyResetUrl}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="复制重置链接"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? '正在生成...' : '获取重置链接'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center border-t border-border pt-4">
          <Link
            to="/login"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回登录
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
