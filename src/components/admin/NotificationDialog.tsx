import { useState, useEffect } from 'react';
import { Send, Mail, MessageSquare, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export type NotificationType = 'in_app' | 'email' | 'both';

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string; // 单发模式
  userEmail?: string; // 单发模式显示
  broadcastMode?: boolean; // 群发模式
  userCount?: number; // 群发模式显示数量
  onSuccess?: () => void; // 成功回调
}

const notificationTypes = [
  { value: 'in_app' as const, label: '站内信', icon: MessageSquare, description: '仅发送到用户站内通知' },
  { value: 'email' as const, label: '邮件', icon: Mail, description: '仅发送到用户邮箱' },
  { value: 'both' as const, label: '同时发送', icon: Send, description: '站内信和邮件同时发送' },
];

const broadcastTargets = [
  { value: 'all' as const, label: '所有用户' },
  { value: 'user' as const, label: '普通用户' },
  { value: 'admin' as const, label: '管理员' },
];

export function NotificationDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  broadcastMode = false,
  userCount,
  onSuccess,
}: NotificationDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NotificationType>('in_app');
  const [targetRole, setTargetRole] = useState<'all' | 'user' | 'admin'>('all');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setContent('');
      setType('in_app');
      setTargetRole('all');
      setLink('');
    }
  }, [open]);

  const getAuthHeaders = (): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type,
        ...(link && { link: link.trim() }),
      };

      if (broadcastMode) {
        // 群发模式
        await fetch('/api/admin/users/notify/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            ...payload,
            targetRole,
          }),
        });
      } else if (userId) {
        // 单发模式
        await fetch(`/api/admin/users/${userId}/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('发送通知失败:', error);
      // TODO: 显示错误提示
    } finally {
      setSending(false);
    }
  };

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={!sending}>
        <DialogHeader>
          <DialogTitle>
            {broadcastMode ? '群发系统通知' : '发送通知'}
          </DialogTitle>
          <DialogDescription>
            {broadcastMode
              ? `将发送给 ${userCount || 0} 位用户`
              : `将发送给 ${userEmail || userId}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 接收人信息 */}
          {broadcastMode && (
            <div className="flex flex-wrap gap-2">
              {broadcastTargets.map((target) => (
                <button
                  key={target.value}
                  onClick={() => setTargetRole(target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    targetRole === target.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-hover text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {target.label}
                </button>
              ))}
            </div>
          )}

          {/* 通知类型选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">通知类型</label>
            <div className="grid grid-cols-3 gap-2">
              {notificationTypes.map((notifType) => {
                const Icon = notifType.icon;
                return (
                  <button
                    key={notifType.value}
                    onClick={() => setType(notifType.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      type === notifType.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${type === notifType.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-center">
                      <div className={`text-sm font-medium ${type === notifType.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notifType.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              标题 <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              placeholder="请输入通知标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={sending}
              maxLength={200}
              className={title.length > 150 ? 'border-destructive' : ''}
            />
            <div className="flex justify-end">
              <span className={`text-xs ${title.length > 150 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {title.length} / 200
              </span>
            </div>
          </div>

          {/* 内容 */}
          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium text-foreground">
              内容 <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="content"
              placeholder="请输入通知内容"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={sending}
              rows={6}
              maxLength={5000}
              className={content.length > 4000 ? 'border-destructive' : ''}
            />
            <div className="flex justify-end">
              <span className={`text-xs ${content.length > 4000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {content.length} / 5000
              </span>
            </div>
          </div>

          {/* 链接（可选） */}
          <div className="space-y-2">
            <label htmlFor="link" className="text-sm font-medium text-foreground">
              链接 <span className="text-muted-foreground">（可选）</span>
            </label>
            <Input
              id="link"
              type="url"
              placeholder="https://example.com"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={sending}
              maxLength={500}
            />
          </div>

          {/* 预览 */}
          {(title || content) && (
            <div className="space-y-2 p-4 rounded-lg bg-surface-hover border border-border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                预览
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {type === 'email' || type === 'both' ? (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    {title || '标题'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {content || '内容'}
                </div>
                {link && (
                  <div className="text-xs text-primary">
                    👉 {link}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                发送中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {broadcastMode ? '群发通知' : '发送通知'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
