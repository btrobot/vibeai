import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Video,
  FileText,
  MessageSquare,
  GitBranch,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: string;
  tags: string[];
  taskCount: number;
  completedTaskCount: number;
}

interface Create {
  id: string;
  capabilitySlug: string;
  prompt: string;
  sourceCreateId: string | null;
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'cancelled';
  output: Record<string, unknown> | null;
  modelSlug: string | null;
  taskCount: number;
  errorMessage: string | null;
  taskStatus: string | null;
  taskProgress: number;
  createdAt: string;
  updatedAt: string;
}

const capabilities = [
  { slug: 'text-generation', label: '文本生成', icon: MessageSquare, color: 'text-primary' },
  { slug: 'image-generation', label: '图像生成', icon: ImageIcon, color: 'text-brand' },
  { slug: 'video-generation', label: '视频生成', icon: Video, color: 'text-foreground' },
  { slug: 'background-removal', label: '白底图', icon: ImageIcon, color: 'text-muted-foreground' },
  { slug: 'scene-composition', label: '场景合成', icon: ImageIcon, color: 'text-brand' },
  { slug: 'model-dressing', label: '模特换装', icon: ImageIcon, color: 'text-primary' },
  { slug: 'detail-page-generation', label: '详情页', icon: FileText, color: 'text-foreground' },
];

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [creates, setCreates] = useState<Create[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCapability, setActiveCapability] = useState('text-generation');
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sourceCreateId, setSourceCreateId] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const fetchProject = async () => {
    try {
      const [projectRes, createsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { headers: { ...getAuthHeaders() } }),
        fetch(`/api/projects/${projectId}/creates?pageSize=50`, { headers: { ...getAuthHeaders() } }),
      ]);

      if (projectRes.ok) setProject(await projectRes.json());
      if (createsRes.ok) {
        const createsData = await createsRes.json();
        setCreates(createsData.items ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchProject();
  }, [projectId]);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/gateway/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          projectId,
          capabilitySlug: activeCapability,
          input: { prompt: prompt.trim() },
          sourceCreateId: sourceCreateId ?? undefined,
        }),
      });

      if (res.ok) {
        setPrompt('');
        setSourceCreateId(null);
        fetchProject();
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (createId: string) => {
    try {
      const res = await fetch(`/api/creates/${createId}/retry`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) fetchProject();
    } catch {
      // Silently fail
    }
  };

  const handleModify = (create: Create) => {
    setSourceCreateId(create.id);
    setPrompt(create.prompt);
    setActiveCapability(create.capabilitySlug);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: 'default' | 'primary' | 'brand' | 'destructive'; spin?: boolean }> = {
    draft: { icon: Clock, label: '草稿', variant: 'default' },
    processing: { icon: Loader2, label: '生成中...', variant: 'primary', spin: true },
    completed: { icon: CheckCircle2, label: '已完成', variant: 'brand' },
    failed: { icon: XCircle, label: '生成失败', variant: 'destructive' },
    cancelled: { icon: XCircle, label: '已取消', variant: 'default' },
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col p-4 space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Capability Selector + Chat */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => navigate('/projects')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            aria-label="返回项目列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">{project?.name || '工作区'}</h1>
            {project?.description && (
              <p className="text-xs text-muted-foreground truncate max-w-md">{project.description}</p>
            )}
          </div>
        </div>

        {/* Capability Tabs */}
        <div className="flex gap-1 border-b border-border px-4 py-2 overflow-x-auto">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <button
                key={cap.slug}
                onClick={() => setActiveCapability(cap.slug)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCapability === cap.slug
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${activeCapability === cap.slug ? 'text-primary' : cap.color}`} />
                {cap.label}
              </button>
            );
          })}
        </div>

        {/* Create List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {creates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="输入提示词开始创作"
              description="选择上方的创作能力，在下方输入框中描述你的需求"
              className="py-16"
            />
          ) : (
            creates.map((create) => {
              const cfg = statusConfig[create.status] || statusConfig.draft;
              const Icon = cfg.icon;
              const capLabel = capabilities.find((c) => c.slug === create.capabilitySlug)?.label || create.capabilitySlug;
              return (
                <div
                  key={create.id}
                  className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {create.sourceCreateId && (
                        <GitBranch className="h-3 w-3 text-muted-foreground" aria-label="修改自之前的创作" />
                      )}
                      <span className="text-xs font-medium text-foreground">{capLabel}</span>
                      <Badge variant={cfg.variant}>
                        <Icon className={`h-3 w-3 ${cfg.spin ? 'animate-spin' : ''}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                    {create.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(create.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                      >
                        <RotateCw className="h-3 w-3" />
                        重试
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-foreground mb-1">{create.prompt}</p>

                  {create.status === 'processing' && (
                    <Progress value={create.taskProgress} size="slim" className="mt-2" />
                  )}

                  {create.status === 'failed' && create.errorMessage && (
                    <p className="text-xs text-destructive mt-2">{create.errorMessage}</p>
                  )}

                  {create.status === 'completed' && create.output && (
                    <div className="mt-2 rounded-lg bg-background p-3">
                      {create.capabilitySlug === 'image-generation' || create.capabilitySlug === 'background-removal' || create.capabilitySlug === 'scene-composition' || create.capabilitySlug === 'model-dressing' ? (
                        (create.output as { images?: string[] }).images?.map((url: string, i: number) => (
                          <img key={i} src={url} alt="" className="max-h-48 rounded object-contain" />
                        ))
                      ) : create.capabilitySlug === 'video-generation' ? (
                        (create.output as { videos?: string[] }).videos?.map((url: string, i: number) => (
                          <video key={i} src={url} controls className="max-h-48 rounded" />
                        ))
                      ) : (
                        <p className="text-xs text-foreground whitespace-pre-wrap">
                          {(create.output as { text?: string }).text || JSON.stringify(create.output, null, 2)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(create.createdAt).toLocaleString('zh-CN')}
                    </p>
                    {create.status === 'completed' && (
                      <button
                        onClick={() => handleModify(create)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                      >
                        <GitBranch className="h-3 w-3" />
                        基于此修改
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          {sourceCreateId && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">基于之前的创作修改</span>
              <button
                onClick={() => { setSourceCreateId(null); setPrompt(''); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入提示词，按 Enter 发送..."
              rows={2}
              className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none transition-all duration-150"
            />
            <Button
              variant="brand"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleSubmit}
              disabled={!prompt.trim() || submitting}
              aria-label="发送"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
