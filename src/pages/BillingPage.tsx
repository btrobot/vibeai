import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Check, Zap, HardDrive, Layers, Crown, RefreshCw, History, TrendingUp } from 'lucide-react';

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  credits: number;
  priceMonthly: number;
  priceYearly: number | null;
  maxProjects: number;
  maxStorageBytes: number;
  maxConcurrentTasks: number;
  capabilities: string[];
  features: Record<string, unknown>;
  sortOrder: number;
}

interface Subscription {
  id: string;
  plan: Plan | null;
  status: string;
  billingCycle: string;
  creditsRemaining: number;
  creditsUsed: number;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
}

interface UsageStats {
  totalCreditsUsed: number;
  creditsRemaining: number;
  creditsUsedThisMonth: number;
  totalTasksCompleted: number;
  totalImagesGenerated: number;
  totalVideosGenerated: number;
  storageUsedBytes: number;
  planSlug: string;
  planName: string;
  periodStart: string;
  periodEnd: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export default function BillingPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token]);

  async function fetchData() {
    setLoading(true);
    try {
      const [plansRes, subRes, statsRes, payRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/payment-status', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const plansData = await plansRes.json();
      if (plansData.success) setPlans(plansData.data);
      const subData = await subRes.json();
      if (subData.success) setSubscription(subData.data);
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);
      const payData = await payRes.json();
      setPaymentEnabled(payData.enabled === true);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planSlug: string, cycle: 'monthly' | 'yearly') {
    setSubscribing(planSlug);
    try {
      // If payment is enabled and plan is not free, use Stripe Checkout
      if (paymentEnabled && planSlug !== 'free') {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ planSlug, billingCycle: cycle }),
        });
        const data = await res.json();
        if (data.url) {
          // Redirect to Stripe Checkout
          window.location.href = data.url;
          return;
        }
      }

      // Direct subscribe (free plans or when payment is not configured)
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planSlug, billingCycle: cycle }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.data);
        const statsRes = await fetch('/api/billing/stats', { headers: { Authorization: `Bearer ${token}` } });
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
    } catch {
      // Silently fail
    } finally {
      setSubscribing(null);
    }
  }

  async function handleCancel() {
    try {
      const res = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubscription(null);
        await fetchData();
      }
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlanSlug = subscription?.plan?.slug ?? 'free';

  const planIcons: Record<string, React.ReactNode> = {
    free: <Zap className="w-5 h-5" />,
    starter: <Layers className="w-5 h-5" />,
    pro: <Crown className="w-5 h-5" />,
    enterprise: <Crown className="w-5 h-5" />,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">计费管理</h1>
        <p className="text-sm text-muted-foreground mt-1">管理你的套餐和用量</p>
      </div>

      {/* Usage Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              用量概览
            </CardTitle>
            <CardDescription>
              当前套餐：{stats.planName} | 结算周期：{formatDate(stats.periodStart)} ~ {stats.periodEnd ? formatDate(stats.periodEnd) : '无限制'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-surface-hover">
                <div className="text-sm text-muted-foreground mb-1">可用额度</div>
                <div className="text-3xl font-bold font-mono text-brand">{stats.creditsRemaining}</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-hover">
                <div className="text-sm text-muted-foreground mb-1">本月已用</div>
                <div className="text-3xl font-bold font-mono text-foreground">{stats.creditsUsedThisMonth}</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-hover">
                <div className="text-sm text-muted-foreground mb-1">完成任务</div>
                <div className="text-3xl font-bold font-mono text-foreground">{stats.totalTasksCompleted}</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-hover">
                <div className="text-sm text-muted-foreground mb-1">存储用量</div>
                <div className="text-3xl font-bold font-mono text-foreground">{formatBytes(stats.storageUsedBytes)}</div>
              </div>
            </div>

            {/* Credit Usage Bar */}
            {stats.creditsUsedThisMonth > 0 && stats.creditsRemaining > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>额度使用率</span>
                  <span className="font-mono">{Math.round((stats.creditsUsedThisMonth / (stats.creditsUsedThisMonth + stats.creditsRemaining)) * 100)}%</span>
                </div>
                <Progress
                  variant="brand"
                  value={Math.min((stats.creditsUsedThisMonth / (stats.creditsUsedThisMonth + stats.creditsRemaining)) * 100, 100)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">选择套餐</h2>
          {paymentEnabled && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  billingCycle === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setBillingCycle('monthly')}
              >
                按月
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  billingCycle === 'yearly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setBillingCycle('yearly')}
              >
                按年
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = currentPlanSlug === plan.slug;
            return (
              <Card
                key={plan.id}
                className={`relative transition-all duration-200 hover:border-brand/50 ${
                  isCurrent ? 'ring-1 ring-brand' : ''
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand text-xs font-medium rounded-full text-brand-foreground">
                    当前套餐
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-brand">{planIcons[plan.slug]}</span>
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {plan.description}
                  </CardDescription>
                  <div className="mt-3">
                    <span className="text-3xl font-bold font-mono text-foreground">
                      ¥{billingCycle === 'yearly' && plan.priceYearly ? plan.priceYearly : plan.priceMonthly}
                    </span>
                    <span className="text-muted-foreground text-sm ml-1">
                      /{billingCycle === 'yearly' ? '年' : '月'}
                    </span>
                    {billingCycle === 'yearly' && plan.priceMonthly > 0 && plan.priceYearly && (
                      <span className="block text-xs text-brand mt-1">省 ¥{plan.priceMonthly * 12 - plan.priceYearly}/年</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      <span>每月 {plan.credits} 额度</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      <span>最多 {plan.maxProjects} 个项目</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      <span>最多 {plan.maxConcurrentTasks} 并发</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      <span>存储 {formatBytes(plan.maxStorageBytes)}</span>
                    </div>
                    {plan.capabilities.length > 0 && plan.capabilities[0] !== '*' && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                        <span>{plan.capabilities.length} 项能力</span>
                      </div>
                    )}
                    {plan.capabilities.length > 0 && plan.capabilities[0] === '*' && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                        <span>全部能力</span>
                      </div>
                    )}
                    {!!(plan.features as Record<string, unknown>).apiAccess && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                        <span>API 访问</span>
                      </div>
                    )}
                    {!!(plan.features as Record<string, unknown>).teamSeats && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                        <span>{String(plan.features.teamSeats)} 个团队席位</span>
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full mt-4"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || subscribing === plan.slug}
                    onClick={() => handleSubscribe(plan.slug, billingCycle)}
                  >
                    {subscribing === plan.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrent ? '当前套餐' : plan.priceMonthly === 0 ? '免费使用' : paymentEnabled ? '立即支付' : '升级'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Current Subscription Info */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-brand" />
              订阅信息
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1 text-sm">
              <div className="text-muted-foreground">
                套餐：{subscription.plan?.name ?? '未知'}
              </div>
              <div className="text-muted-foreground">
                周期：{subscription.billingCycle === 'monthly' ? '按月' : '按年'}
                {subscription.autoRenew ? '（自动续费）' : '（不续费）'}
              </div>
              <div className="text-muted-foreground">
                本周期：{formatDate(subscription.currentPeriodStart)} ~ {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '永久'}
              </div>
            </div>
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={handleCancel}>
              取消订阅
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Credit History */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-brand" />
              额度明细
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>总消耗：<span className="font-mono text-foreground">{stats.totalCreditsUsed}</span> 额度</p>
              <p>图片生成：<span className="font-mono text-foreground">{stats.totalImagesGenerated}</span> 次</p>
              <p>视频生成：<span className="font-mono text-foreground">{stats.totalVideosGenerated}</span> 次</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
