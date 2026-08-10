import { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Eye,
  User,
  TrendingUp,
  Clock,
  Flame,
  Sparkles,
  Star,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  authorName: string;
  likes: number;
  comments: number;
  views: number;
  type: string;
  createdAt: string;
}

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState<'trending' | 'latest' | 'following'>('trending');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<GalleryItem[]>([]);

  const tabs = [
    { key: 'trending', label: '热门', icon: Flame },
    { key: 'latest', label: '最新', icon: Clock },
    { key: 'following', label: '关注', icon: User },
  ];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gallery/works?sort=${activeTab}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setItems((res.data ?? []).map((w: { id: string; title?: string; imageUrl?: string; authorName?: string; likes?: number; comments?: number; views?: number; type?: string; createdAt: string }) => ({
            id: w.id,
            title: w.title || '未命名作品',
            imageUrl: w.imageUrl || '',
            authorName: w.authorName || '匿名',
            likes: w.likes ?? 0,
            comments: w.comments ?? 0,
            views: w.views ?? 0,
            type: w.type || 'image',
            createdAt: w.createdAt,
          })));
        } else {
          setItems([]);
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => {
    fetch('/api/gallery/featured?limit=8')
      .then((r) => r.json())
      .then((res) => {
        const data = res.data ?? res;
        if (Array.isArray(data)) {
          setFeatured(data.map((w: Record<string, unknown>) => ({
            id: String(w.id ?? ''),
            title: String(w.title ?? '未命名作品'),
            imageUrl: String(w.imageUrl ?? ''),
            authorName: String(w.authorName ?? '匿名'),
            likes: Number(w.likes ?? 0),
            comments: Number(w.comments ?? 0),
            views: Number(w.views ?? 0),
            type: String(w.type ?? 'image'),
            createdAt: String(w.createdAt ?? new Date().toISOString()),
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">社区画廊</h1>
          <p className="text-sm text-muted-foreground mt-1">发现其他创作者的精彩作品</p>
        </div>
      </div>

      {/* Featured Works */}
      {featured.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-foreground">推荐作品</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featured.map((work) => (
              <div
                key={work.id}
                className="group relative h-40 w-64 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-card"
              >
                {work.imageUrl ? (
                  <img
                    src={work.imageUrl}
                    alt={work.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="truncate text-sm font-medium text-white">{work.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/80">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {work.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {work.views}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="暂无作品"
          description="社区画廊即将上线，敬请期待！你可以先在创作工具中生成作品。"
          className="py-20"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group cursor-pointer rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30"
            >
              <div className="aspect-square bg-background">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.authorName}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" aria-hidden="true" />
                    {item.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" aria-hidden="true" />
                    {item.comments}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    {item.views}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
