import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuthHeaders } from './admin/types';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_MS = 30_000;

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return;
      const json = await res.json();
      setUnread(Number(json?.data?.count ?? 0));
    } catch {
      // ignore
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=5', {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json?.data?.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const t = window.setInterval(fetchUnread, POLL_MS);
    return () => window.clearInterval(t);
  }, [fetchUnread]);

  useEffect(() => {
    if (!open) return;
    fetchRecent();
  }, [open, fetchRecent]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markOne = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, {
          method: 'POST',
          headers: { ...getAuthHeaders() },
        });
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="通知"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white"
            aria-label={`${unread} 条未读`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">通知</h3>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                全部已读
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无通知</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n)}
                  className={`flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-hover ${
                    n.isRead ? '' : 'bg-brand/5'
                  }`}
                >
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  {n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    {n.content && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            查看全部通知
          </Link>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}