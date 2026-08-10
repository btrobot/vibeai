import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Eye, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface GalleryDetail {
  id: string;
  title: string;
  description?: string;
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  authorName: string;
  likes: number;
  views: number;
  type: string;
  createdAt: string;
}

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const fetchWork = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/gallery/works/${id}`);
      const json = await res.json();
      const data = json.data ?? json;
      if (data && data.id) {
        setWork({
          id: data.id,
          title: data.title || '未命名作品',
          description: data.description,
          prompt: data.prompt,
          imageUrl: data.imageUrl ?? data.thumbnailUrl,
          videoUrl: data.videoUrl,
          thumbnailUrl: data.thumbnailUrl,
          authorName: data.authorName || '匿名',
          likes: data.likes ?? 0,
          views: data.views ?? 0,
          type: data.type || 'image',
          createdAt: data.createdAt,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWork();
  }, [fetchWork]);

  const handleLike = async () => {
    if (!work) return;
    const token = localStorage.getItem('auth_tokens');
    if (!token) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    setLikeLoading(true);
    try {
      const { accessToken } = JSON.parse(token);
      const res = await fetch(`/api/gallery/works/${work.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        if (typeof data?.liked === 'boolean') setLiked(data.liked);
        if (typeof data?.likes === 'number') setWork({ ...work, likes: data.likes });
      }
    } catch {
      // ignore
    } finally {
      setLikeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!work) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/gallery">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回画廊
          </Link>
        </Button>
        <EmptyState
          icon={ImageIcon}
          title="作品不存在或已被删除"
          description="该作品可能尚未公开，或已被创作者删除"
        />
      </div>
    );
  }

  const preview = work.imageUrl || work.thumbnailUrl || work.videoUrl || '';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/gallery">
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回画廊
        </Link>
      </Button>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="bg-surface-hover">
          {work.type === 'video' && work.videoUrl ? (
            <video
              src={work.videoUrl}
              controls
              className="mx-auto max-h-[70vh] w-full"
              poster={work.thumbnailUrl}
            />
          ) : preview ? (
            <img
              src={preview}
              alt={work.title}
              className="mx-auto max-h-[70vh] w-full object-contain"
            />
          ) : (
            <div className="flex h-72 items-center justify-center">
              <ImageIcon className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{work.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by {work.authorName} · {new Date(work.createdAt).toLocaleDateString('zh-CN')}
            </p>
          </div>

          {work.prompt && (
            <div className="rounded-lg bg-surface-hover p-3">
              <p className="text-xs font-medium text-muted-foreground">提示词</p>
              <p className="mt-1 text-sm text-foreground">{work.prompt}</p>
            </div>
          )}

          {work.description && (
            <p className="text-sm text-foreground">{work.description}</p>
          )}

          <div className="flex items-center gap-4 border-t border-border pt-4">
            <Button
              variant={liked ? 'brand' : 'outline'}
              size="sm"
              onClick={handleLike}
              disabled={likeLoading}
            >
              {likeLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Heart className={`mr-1 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              )}
              {work.likes} 点赞
            </Button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              {work.views} 浏览
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}