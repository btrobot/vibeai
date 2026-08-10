import { useState, useEffect } from 'react';
import { Megaphone, X, AlertTriangle, Wrench } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'maintenance';
  isPinned: boolean;
}

const TYPE_ICON = {
  info: Megaphone,
  warning: AlertTriangle,
  maintenance: Wrench,
} as const;

const TYPE_STYLES = {
  info: 'border-brand/30 bg-brand/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  maintenance: 'border-destructive/30 bg-destructive/5',
} as const;

const TYPE_ICON_COLOR = {
  info: 'text-brand',
  warning: 'text-amber-600',
  maintenance: 'text-destructive',
} as const;

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/announcements/active')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const data = res.data ?? res;
        if (Array.isArray(data)) {
          setAnnouncements(data);
        }
      })
      .catch(() => {
        // ignore - banner is non-critical
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  // Show only the top (pinned first) announcement as a banner
  const top = visible[0];

  const Icon = TYPE_ICON[top.type] ?? Megaphone;

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2 ${TYPE_STYLES[top.type] ?? TYPE_STYLES.info}`}>
      <Icon className={`h-4 w-4 shrink-0 ${TYPE_ICON_COLOR[top.type] ?? TYPE_ICON_COLOR.info}`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{top.title}</span>
        {top.content && (
          <span className="ml-2 text-sm text-muted-foreground truncate">{top.content}</span>
        )}
      </div>
      <button
        onClick={() => setDismissed((prev) => new Set(prev).add(top.id))}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="关闭公告"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
