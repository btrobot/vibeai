import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSeo } from '@/hooks/useSeo';

interface PublicHero {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

interface FeaturedItem {
  id: string;
  title: string;
  prompt?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  type: 'image' | 'video';
}

const DEFAULT_HERO: PublicHero = {
  title: 'AI 驱动的内容创作',
  subtitle: '图片、视频、文案一站式生成',
  ctaText: '开始创作',
  ctaLink: '/register',
};

export default function PublicHomePage() {
  useSeo({}); // pulls default seo.* from /api/system-config/public?category=seo

  const [hero, setHero] = useState<PublicHero>(DEFAULT_HERO);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [latest, setLatest] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [homeRes, featuredRes, latestRes] = await Promise.all([
          fetch('/api/system-config/public/homepage.hero'),
          fetch('/api/gallery/featured?limit=8'),
          fetch('/api/gallery/works?sort=latest&page=1&limit=12'),
        ]);

        if (!cancelled && homeRes.ok) {
          const data = await homeRes.json();
          const value = data.data?.value ?? data.value ?? data.data ?? data;
          if (value && typeof value === 'object') {
            setHero({ ...DEFAULT_HERO, ...value });
          }
        }

        if (!cancelled && featuredRes.ok) {
          const data = await featuredRes.json();
          setFeatured(data.data ?? []);
        }

        if (!cancelled && latestRes.ok) {
          const data = await latestRes.json();
          setLatest(data.data?.items ?? data.data ?? []);
        }
      } catch {
        // ignore — public page should still render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav (minimal) */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-brand" />
            VibeAI
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">登录</Link>
            </Button>
            <Button variant="brand" size="sm" asChild>
              <Link to={hero.ctaLink}>{hero.ctaText}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="brand" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            AI 创作平台
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{hero.subtitle}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="brand" size="lg" asChild>
              <Link to={hero.ctaLink}>{hero.ctaText}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/gallery">浏览画廊</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured */}
      {(loading || featured.length > 0) && (
        <section className="border-t border-border bg-surface-hover/30 px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-6 text-2xl font-semibold text-foreground">推荐作品</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : featured.length === 0 ? (
              <EmptyState icon={ImageIcon} title="暂无推荐" />
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {featured.map((w) => (
                  <WorkCard key={w.id} work={w} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Latest */}
      {(loading || latest.length > 0) && (
        <section className="px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">最新作品</h2>
              <Link
                to="/gallery"
                className="text-sm text-brand hover:underline"
              >
                查看全部 →
              </Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {latest.slice(0, 8).map((w) => (
                  <WorkCard key={w.id} work={w} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="border-t border-border bg-card px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">准备好开始创作了吗？</h2>
          <p className="mt-2 text-muted-foreground">注册即送 100 积分，无需信用卡</p>
          <Button variant="brand" size="lg" className="mt-6" asChild>
            <Link to="/register">免费注册</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function WorkCard({ work }: { work: FeaturedItem }) {
  const preview = work.thumbnailUrl || work.imageUrl || '';
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-surface-hover">
        {preview ? (
          <img
            src={preview}
            alt={work.title || work.prompt || '作品'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="line-clamp-1 text-xs text-foreground">{work.title || work.prompt || '未命名'}</p>
      </div>
    </Card>
  );
}