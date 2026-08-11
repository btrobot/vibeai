import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { getAuthHeaders } from '../components/admin/types';

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

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [marking, setMarking] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const url = f === 'unread' ? '/api/notifications?unreadOnly=true' : '/api/notifications';
      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
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
    load(filter);
  }, [filter, load]);

  const markOne = async (n: Notification) => {
    if (n.isRead) {
      if (n.link) navigate(n.link);
      return;
    }
    setMarking(n.id);
    try {
      await fetch(`/api/notifications/${n.id}/read`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    } catch {
      // ignore
    } finally {
      setMarking(null);
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">通知</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterButton current={filter} value="all" onClick={() => setFilter('all')}>
            全部
          </FilterButton>
          <FilterButton current={filter} value="unread" onClick={() => setFilter('unread')}>
            未读
          </FilterButton>
          {unreadCount > 0 && (
            <button
              onClick={markAll}
              disabled={markingAll}
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              全部已读
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter === 'unread' ? '没有未读通知' : '暂无通知'}
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((n) => (
            <li key={n.id} className="border-b border-border last:border-b-0">
              <button
                onClick={() => markOne(n)}
                disabled={marking === n.id}
                className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-hover disabled:opacity-50 ${
                  n.isRead ? '' : 'bg-brand/5'
                }`}
              >
                {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                {n.isRead && <span className="mt-2 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatTimeAgo(n.createdAt)}
                    </p>
                  </div>
                  {n.content && (
                    <p className="mt-1 text-sm text-muted-foreground">{n.content}</p>
                  )}
                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-block text-xs text-brand hover:underline"
                    >
                      查看详情 →
                    </Link>
                  )}
                </div>
                {!n.isRead && (
                  <Check
                    className={`mt-1 h-4 w-4 shrink-0 ${
                      marking === n.id
                        ? 'animate-spin text-muted-foreground'
                        : 'text-muted-foreground'
                    }`}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Filter;
  value: Filter;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-brand text-white'
          : 'border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground'
      }`}
    >
      {children}
    </button>
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