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
  Loader2,
} from 'lucide-react';

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
          setItems((res.data ?? []).map((w: any) => ({
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">社区画廊</h1>
          <p className="text-sm text-muted mt-1">发现其他创作者的精彩作品</p>
        </div>
      </div>

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
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-muted animate-spin" />
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card-hover">
            <ImageIcon className="h-8 w-8 text-muted" />
          </div>
          <h3 className="text-base font-medium text-foreground">暂无作品</h3>
          <p className="text-sm text-muted text-center max-w-sm">
            社区画廊即将上线，敬请期待！你可以先在创作工具中生成作品。
          </p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <TrendingUp className="h-3 w-3" />
            <span>社区功能开发中</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-colors hover:border-primary/30"
            >
              <div className="aspect-square bg-background">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                <p className="text-xs text-muted mt-1">{item.authorName}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {item.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {item.comments}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
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