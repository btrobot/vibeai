import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      const [plansRes, subRes, statsRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const plansData = await plansRes.json();
      if (plansData.success) setPlans(plansData.data);
      const subData = await subRes.json();
      if (subData.success) setSubscription(subData.data);
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Failed to fetch billing data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planSlug: string) {
    setSubscribing(planSlug);
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planSlug, billingCycle: 'monthly' }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.data);
        // Refresh stats
        const statsRes = await fetch('/api/billing/stats', { headers: { Authorization: `Bearer ${token}` } });
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
    } catch (err) {
      console.error('Failed to subscribe:', err);
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
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(0,0%,4%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(160,40%,40%)]" />
      </div>
    );
  }

  const currentPlanSlug = subscription?.plan?.slug ?? 'free';

  const planIcons: Record<string, React.ReactNode> = {
    free: <Zap className="w-6 h-6" />,
    starter: <Layers className="w-6 h-6" />,
    pro: <Crown className="w-6 h-6" />,
    enterprise: <Crown className="w-6 h-6" />,
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-[hsl(0,0%,93%)]">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,16%)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">VibeAI</h1>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/storage')}>文件管理</Button>
            <Button variant="ghost" className="text-[hsl(160,40%,40%)]">计费</Button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Usage Stats */}
        {stats && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,16%)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[hsl(160,40%,40%)]" />
                用量概览
              </CardTitle>
              <CardDescription className="text-[hsl(0,0%,60%)]">
                当前套餐：{stats.planName} | 结算周期：{formatDate(stats.periodStart)} ~ {stats.periodEnd ? formatDate(stats.periodEnd) : '无限制'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-[hsl(0,0%,12%)]">
                  <div className="text-sm text-[hsl(0,0%,60%)] mb-1">可用额度</div>
                  <div className="text-2xl font-bold text-[hsl(160,40%,40%)]">{stats.creditsRemaining}</div>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(0,0%,12%)]">
                  <div className="text-sm text-[hsl(0,0%,60%)] mb-1">本月已用</div>
                  <div className="text-2xl font-bold">{stats.creditsUsedThisMonth}</div>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(0,0%,12%)]">
                  <div className="text-sm text-[hsl(0,0%,60%)] mb-1">完成任务</div>
                  <div className="text-2xl font-bold">{stats.totalTasksCompleted}</div>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(0,0%,12%)]">
                  <div className="text-sm text-[hsl(0,0%,60%)] mb-1">存储用量</div>
                  <div className="text-2xl font-bold">{formatBytes(stats.storageUsedBytes)}</div>
                </div>
              </div>

              {/* Credit Usage Bar */}
              {stats.creditsUsedThisMonth > 0 && stats.creditsRemaining > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-[hsl(0,0%,60%)] mb-2">
                    <span>额度使用率</span>
                    <span>{Math.round((stats.creditsUsedThisMonth / (stats.creditsUsedThisMonth + stats.creditsRemaining)) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-[hsl(0,0%,16%)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[hsl(160,40%,40%)] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((stats.creditsUsedThisMonth / (stats.creditsUsedThisMonth + stats.creditsRemaining)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Cards */}
        <section>
          <h2 className="text-lg font-semibold mb-4">选择套餐</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlanSlug === plan.slug;
              return (
                <Card
                  key={plan.id}
                  className={`bg-[hsl(0,0%,8%)] border-[hsl(0,0%,16%)] relative transition-all duration-200 hover:border-[hsl(160,40%,40%)]/50 ${
                    isCurrent ? 'ring-1 ring-[hsl(160,40%,40%)]' : ''
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[hsl(160,40%,40%)] text-xs font-medium rounded-full text-white">
                      当前套餐
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[hsl(160,40%,40%)]">{planIcons[plan.slug]}</span>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    <CardDescription className="text-[hsl(0,0%,60%)]">
                      {plan.description}
                    </CardDescription>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">¥{plan.priceMonthly}</span>
                      <span className="text-[hsl(0,0%,60%)] text-sm ml-1">/月</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                        <span>每月 {plan.credits} 额度</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                        <span>最多 {plan.maxProjects} 个项目</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                        <span>最多 {plan.maxConcurrentTasks} 并发</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                        <span>存储 {formatBytes(plan.maxStorageBytes)}</span>
                      </div>
                      {plan.capabilities.length > 0 && plan.capabilities[0] !== '*' && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                          <span>{plan.capabilities.length} 项能力</span>
                        </div>
                      )}
                      {plan.capabilities.length > 0 && plan.capabilities[0] === '*' && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                          <span>全部能力</span>
                        </div>
                      )}
                      {!!(plan.features as Record<string, unknown>).apiAccess && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                          <span>API 访问</span>
                        </div>
                      )}
                      {!!(plan.features as Record<string, unknown>).teamSeats && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[hsl(160,40%,40%)]" />
                          <span>{String(plan.features.teamSeats)} 个团队席位</span>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full mt-4"
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent || subscribing === plan.slug}
                      onClick={() => handleSubscribe(plan.slug)}
                    >
                      {subscribing === plan.slug ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {isCurrent ? '当前套餐' : plan.priceMonthly === 0 ? '免费使用' : '升级'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Current Subscription Info */}
        {subscription && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,16%)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[hsl(160,40%,40%)]" />
                订阅信息
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1 text-sm">
                <div className="text-[hsl(0,0%,60%)]">
                  套餐：{subscription.plan?.name ?? '未知'}
                </div>
                <div className="text-[hsl(0,0%,60%)]">
                  周期：{subscription.billingCycle === 'monthly' ? '按月' : '按年'}
                  {subscription.autoRenew ? '（自动续费）' : '（不续费）'}
                </div>
                <div className="text-[hsl(0,0%,60%)]">
                  本周期：{formatDate(subscription.currentPeriodStart)} ~ {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '永久'}
                </div>
              </div>
              <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" onClick={handleCancel}>
                取消订阅
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Credit History */}
        {stats && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,16%)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-[hsl(160,40%,40%)]" />
                额度明细
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-[hsl(0,0%,60%)]">
                <p>总消耗：{stats.totalCreditsUsed} 额度</p>
                <p>图片生成：{stats.totalImagesGenerated} 次</p>
                <p>视频生成：{stats.totalVideosGenerated} 次</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}