import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Share2,
  Wand2,
  Crop,
  Layers,
  Shirt,
  Clapperboard,
  Paperclip,
  X,
  PanelRightClose,
  PanelRightOpen,
  ArrowDown,
  ChevronDown,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useCreateWebSocket, type CreateWsEvent } from '@/hooks/useCreateWebSocket';
import { apiFetch } from '@/lib/apiClient';

// Map backend icon strings to Lucide components
const iconMap: Record<string, LucideIcon> = {
  'message-square': MessageSquare,
  'image': ImageIcon,
  'video': Video,
  'wand-2': Wand2,
  'crop': Crop,
  'layers': Layers,
  'shirt': Shirt,
  'file-text': FileText,
  'clapperboard': Clapperboard,
};

// Category → color mapping
const categoryColor: Record<string, string> = {
  text: 'text-primary',
  image: 'text-brand',
  video: 'text-foreground',
  analysis: 'text-muted-foreground',
};

interface CapabilityInfo {
  slug: string;
  name: string;
  icon: string;
  category: string;
}

interface GatewayModelSummary {
  slug: string;
  name: string;
  description: string | null;
  costCredits: number;
  tags: string[];
  isDefault: boolean;
  sortOrder: number;
  capabilities: string[];
  modality: string;
}

// Fallback capabilities (used while loading or if API fails)
const fallbackCapabilities: CapabilityInfo[] = [
  { slug: 'text-generation', name: '文本生成', icon: 'message-square', category: 'text' },
  { slug: 'image-generation', name: '图像生成', icon: 'image', category: 'image' },
  { slug: 'video-generation', name: '视频生成', icon: 'video', category: 'video' },
  { slug: 'background-removal', name: '白底图', icon: 'crop', category: 'image' },
  { slug: 'scene-composition', name: '场景合成', icon: 'layers', category: 'image' },
  { slug: 'model-dressing', name: '模特换装', icon: 'shirt', category: 'image' },
  { slug: 'detail-page-generation', name: '详情页', icon: 'file-text', category: 'text' },
];

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: string;
  tags: string[];
  totalCreates: number;
  completedCreates: number;
}

interface Create {
  id: string;
  capabilitySlug: string;
  prompt: string;
  input: Record<string, unknown>;
  sourceCreateId: string | null;
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'cancelled';
  output: Record<string, unknown> | null;
  modelSlug: string | null;
  taskCount: number;
  errorMessage: string | null;
  taskId: string | null;
  taskStatus: string | null;
  taskProgress: number;
  createdAt: string;
  updatedAt: string;
}

// Tab bar configuration (merged image tabs for Phase A)
const tabConfig = [
  { slug: 'text-generation', label: '文本生成', icon: MessageSquare, color: 'text-primary' },
  { slug: 'image', label: '图片', icon: ImageIcon, color: 'text-brand' },
  { slug: 'video-generation', label: '视频生成', icon: Video, color: 'text-foreground' },
  { slug: 'detail-page-generation', label: '详情页', icon: FileText, color: 'text-foreground' },
];

const capabilities = [
  { slug: 'text-generation', label: '文本生成', icon: MessageSquare, color: 'text-primary' },
  { slug: 'image-generation', label: '图像生成', icon: ImageIcon, color: 'text-brand' },
  { slug: 'video-generation', label: '视频生成', icon: Video, color: 'text-foreground' },
  { slug: 'background-removal', label: '白底图', icon: ImageIcon, color: 'text-muted-foreground' },
  { slug: 'scene-composition', label: '场景合成', icon: ImageIcon, color: 'text-brand' },
  { slug: 'model-dressing', label: '模特换装', icon: ImageIcon, color: 'text-primary' },
  { slug: 'detail-page-generation', label: '详情页', icon: FileText, color: 'text-foreground' },
];


// Auto-detect image capability from prompt + reference + model support
function detectImageCapability(prompt: string, hasReferenceImage: boolean, modelCapabilities: string[]): string {
  const supported = modelCapabilities.length > 0 ? modelCapabilities : ['image-generation'];
  if (!hasReferenceImage) {
    return supported.includes('image-generation') ? 'image-generation' : supported[0];
  }
  const p = prompt.toLowerCase();
  if (supported.includes('background-removal') && /换背景|白底|移除背景|去背景|抠图|去除背景/.test(p)) {
    return 'background-removal';
  }
  if (supported.includes('model-dressing') && /换装|换衣|穿衣|试穿|模特|穿衣服/.test(p)) {
    return 'model-dressing';
  }
  if (supported.includes('scene-composition') && /场景|合成|融合|合并|组合/.test(p)) {
    return 'scene-composition';
  }
  if (supported.includes('image-editing')) return 'image-editing';
  return supported.includes('image-generation') ? 'image-generation' : supported[0];
}

interface DayGroup {
  key: string;
  label: string;
  items: Create[];
}

// Group chat-flow creates (asc, newest at bottom) by calendar day.
// Day order is ascending too: earliest day on top, latest day at bottom —
// matching iMessage/WeChat style conversation grouping.
function groupCreatesByDay(creates: Create[]): DayGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const groups: DayGroup[] = [];
  for (const c of creates) {
    const d = new Date(c.createdAt);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const key = dayStart === startOfToday ? 'today'
      : dayStart === startOfYesterday ? 'yesterday'
      : d.toISOString().slice(0, 10);
    const label = dayStart === startOfToday ? '今天'
      : dayStart === startOfYesterday ? '昨天'
      : `${d.getMonth() + 1}月${d.getDate()}日`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(c);
    } else {
      groups.push({ key, label, items: [c] });
    }
  }
  return groups;
}

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [creates, setCreates] = useState<Create[]>([]);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<CapabilityInfo[]>(fallbackCapabilities);
  const [activeTab, setActiveTab] = useState('text-generation');
  const [resolvedCapability, setResolvedCapability] = useState('text-generation');
  const [models, setModels] = useState<GatewayModelSummary[]>([]);
  const [selectedModelSlug, setSelectedModelSlug] = useState('');
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sourceCreateId, setSourceCreateId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ fileId: string; previewUrl: string; name: string } | null>(null);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [collapsedDayGroups, setCollapsedDayGroups] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const publishedIdsRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToLatest = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      if (smooth && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToLatest(distFromBottom > 300);
  }, []);

  const toggleDayGroup = useCallback((key: string) => {
    setCollapsedDayGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const processingCount = creates.filter((c) => c.status === 'processing').length;

  // Extract userId from JWT token for WS auth
  const getUserId = (): string | undefined => {
    try {
      const stored = localStorage.getItem('auth_tokens');
      if (!stored) return undefined;
      const { accessToken } = JSON.parse(stored);
      if (!accessToken) return undefined;
      // Decode JWT payload (no verification needed client-side, server validates)
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return payload.sub || payload.userId;
    } catch {
      return undefined;
    }
  };

  // Handle real-time WS events for create updates
  const handleWsEvent = useCallback((event: CreateWsEvent) => {
    const { type, payload } = event;
    const { createId } = payload;
    if (!createId) return;

    setCreates((prev) => {
      const idx = prev.findIndex((c) => c.id === createId);
      if (idx === -1) return prev;

      const updated = [...prev];
      if (type === 'create:progress') {
        updated[idx] = {
          ...updated[idx],
          taskProgress: payload.progress ?? updated[idx].taskProgress,
        };
      } else if (type === 'create:status') {
        const status = payload.status as Create['status'];
        updated[idx] = {
          ...updated[idx],
          status,
          output: payload.output ?? updated[idx].output,
          errorMessage: payload.errorMessage ?? (status === 'failed' ? updated[idx].errorMessage : null),
        };
      }
      return updated;
    });
  }, []);

  useCreateWebSocket({
    userId: getUserId(),
    onEvent: handleWsEvent,
    enabled: !loading,
  });

  const fetchProject = async () => {
    try {
      // Fetch project + creates in parallel (capabilities is non-blocking)
      const [projectRes, createsRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/creates?pageSize=50`),
      ]);

      // Fetch capabilities separately (non-blocking, uses fallback on failure)
      apiFetch('/api/gateway/capabilities')
        .then((res) => res.ok ? res.json() : null)
        .then((capData) => {
          const caps = capData?.data ?? capData;
          if (Array.isArray(caps) && caps.length > 0) {
            setCapabilities(caps.map((c: CapabilityInfo) => ({ slug: c.slug, name: c.name, icon: c.icon, category: c.category })));
          }
        })
        .catch(() => { /* use fallback */ });

      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProject(projectData.data ?? projectData);
      }
      if (createsRes.ok) {
        const createsData = await createsRes.json();
        const createsResult = createsData.data ?? createsData;
        setCreates(createsResult.items ? [...createsResult.items].reverse() : []);
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

  // Chat flow: land at the latest (bottom) once the first load finishes
  useEffect(() => {
    if (!loading && !didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scrollToLatest(false);
    }
  }, [loading, scrollToLatest]);

  useEffect(() => {
    const controller = new AbortController();
    setModels([]);
    setSelectedModelSlug('');
    setModelLoading(true);
    setModelError(null);

    const queryParam = activeTab === 'image'
      ? `modality=image`
      : `capability=${encodeURIComponent(activeTab)}`;
    apiFetch(`/api/gateway/models?${queryParam}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('模型加载失败');
        const result = await response.json() as { data?: GatewayModelSummary[] } | GatewayModelSummary[];
        const data = Array.isArray(result) ? result : result.data ?? [];
        if (!Array.isArray(data)) throw new Error('模型加载失败');
        setModels(data);
        const defaultModel = data.find((model) => model.isDefault) ?? data[0];
        setSelectedModelSlug(defaultModel?.slug ?? '');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setModelError('模型加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelLoading(false);
      });

    return () => controller.abort();
  }, [activeTab]);

  // Clear uploaded file when switching to a non-image-upload capability
  useEffect(() => {
    if (!imageUploadCapabilities.includes(activeTab) && uploadedFile) {
      clearUploadedFile();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve actual capability slug: image tab auto-detects, others use tab slug directly
  useEffect(() => {
    if (activeTab === 'image') {
      const hasRef = !!uploadedFile;
      const modelCaps = models.find((m) => m.slug === selectedModelSlug)?.capabilities || ['image-generation'];
      setResolvedCapability(detectImageCapability(prompt, hasRef, modelCaps));
    } else {
      setResolvedCapability(activeTab);
    }
  }, [activeTab, prompt, uploadedFile, selectedModelSlug, models]);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting || modelLoading || Boolean(modelError) || !selectedModelSlug || models.length === 0) return;
    setSubmitting(true);

    try {
      const input: Record<string, unknown> = { prompt: prompt.trim() };
      if (uploadedFile) {
        input.referenceImage = { fileId: uploadedFile.fileId };
      }

      const res = await apiFetch('/api/gateway/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          capabilitySlug: resolvedCapability,
          modelSlug: selectedModelSlug,
          input,
          sourceCreateId: sourceCreateId ?? undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('success', '创作已提交，正在生成...');
        setPrompt('');
        setSourceCreateId(null);
        clearUploadedFile();
        // Add optimistic create to the list
        const capInfo = capabilities.find((c) => c.slug === resolvedCapability);
        if (data?.data?.createId) {
          setCreates((prev) => [...prev, {
            id: data.data.createId,
            capabilitySlug: resolvedCapability,
            prompt: prompt.trim(),
            input: uploadedFile
              ? { prompt: prompt.trim(), referenceImage: { fileId: uploadedFile.fileId } }
              : { prompt: prompt.trim() },
            sourceCreateId: null,
            status: 'processing' as const,
            output: null,
            modelSlug: data.data.modelSlug ?? selectedModelSlug,
            taskCount: 0,
            errorMessage: null,
            taskId: data.data.taskId ?? null,
            taskStatus: 'queued',
            taskProgress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }]);
        }
        // Still fetch to get the full record
        fetchProject();
        scrollToLatest();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || '提交失败，请重试');
      }
    } catch {
      showToast('error', '网络错误，请检查连接');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (createId: string) => {
    try {
      const res = await apiFetch(`/api/creates/${createId}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('info', '正在重试...');
        fetchProject();
      } else {
        showToast('error', '重试失败');
      }
    } catch {
      showToast('error', '网络错误');
    }
  };

  const handleCancelTask = async (create: Create) => {
    if (!create.taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${create.taskId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('info', '正在取消...');
        fetchProject();
      } else {
        showToast('error', '取消失败，任务可能已完成');
      }
    } catch {
      showToast('error', '取消失败');
    }
  };

  const handleModify = (create: Create) => {
    setSourceCreateId(create.id);
    setPrompt(create.prompt);
    // 修改时切换到对应 tab
    const isImage = ['image-generation','image-editing','background-removal','scene-composition','model-dressing'].includes(create.capabilitySlug);
    setActiveTab(isImage ? 'image' : create.capabilitySlug);
    // 恢复参考图（若原创作曾上传过），避免基于此修改时丢失参考图
    const refImg = (create.input as { referenceImage?: { fileId?: string } } | null)?.referenceImage;
    if (refImg?.fileId) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      apiFetch(`/api/storage/files/${refImg.fileId}`)
        .then(async (res) => {
          if (!res.ok) return;
          const file = await res.json() as { id: string; url: string; originalName: string };
          if (file.url) {
            setUploadedFile({ fileId: file.id, previewUrl: file.url, name: file.originalName || '原参考图' });
          }
        })
        .catch(() => { /* 预览失败不阻塞修改流程 */ });
    }
  };

  // Capabilities that accept a reference image
  const imageUploadCapabilities = ['image'];
  const supportsImageUpload = imageUploadCapabilities.includes(activeTab);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      showToast('error', '请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', '图片大小不能超过 10MB');
      return;
    }

    setUploading(true);
    const previewUrl = URL.createObjectURL(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'temp');

      const uploadRes = await apiFetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (uploadRes.ok) {
        const upload = uploadData.data ?? uploadData;
        const fileId = upload.id;
        if (fileId) {
          setUploadedFile({ fileId, previewUrl, name: file.name });
          showToast('success', '图片已上传');
        } else {
          showToast('error', '上传失败：未获取文件ID');
          URL.revokeObjectURL(previewUrl);
        }
      } else {
        showToast('error', uploadData.message || '上传失败');
        URL.revokeObjectURL(previewUrl);
      }
    } catch {
      showToast('error', '上传失败，请检查网络');
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearUploadedFile = () => {
    if (uploadedFile) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
  };

  const handlePublish = async (create: Create) => {
    const output = create.output as Record<string, unknown> | null;
    const isImage = ['image-generation', 'background-removal', 'scene-composition', 'model-dressing'].includes(create.capabilitySlug);
    const isVideo = create.capabilitySlug === 'video-generation';
    const type = isVideo ? 'video' : 'image';

    try {
      const res = await apiFetch('/api/gallery/works', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createId: create.id,
          type,
          title: create.prompt.slice(0, 50),
        }),
      });
      if (res.ok) {
        publishedIdsRef.current.add(create.id);
        setCreates((prev) => prev.map((c) => (c.id === create.id ? { ...c } : c)));
        showToast('success', '已发布到画廊');
      } else {
        showToast('error', '发布失败');
      }
    } catch {
      showToast('error', '网络错误');
    }
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
      {/* Left+Center: Capability Selector + Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.slug;
            return (
              <button
                key={tab.slug}
                onClick={() => {
                  setActiveTab(tab.slug);
                  // 切换到图片 tab 时清除已上传文件（避免残留不同能力）
                  setUploadedFile(null);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : tab.color}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* LiveBar: processing tasks always visible */}
        {processingCount > 0 && (
          <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs font-medium text-primary">{processingCount} 个任务生成中…</span>
            <button
              onClick={() => {
                const processing = creates.find((c) => c.status === 'processing');
                if (processing) {
                  const el = document.querySelector(`[data-testid="create-card"][data-create-id="${processing.id}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              查看
            </button>
          </div>
        )}

        {/* Create List */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={listRef}
            onScroll={handleListScroll}
            data-testid="create-list"
            className="h-full overflow-y-auto p-4 space-y-3"
          >
          {creates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="输入提示词开始创作"
              description="选择上方的创作能力，在下方输入框中描述你的需求"
              className="py-16"
            />
          ) : (
            (() => {
        const groups = groupCreatesByDay(creates);
        return groups.map((group) => {
          const isCollapsed = collapsedDayGroups.has(group.key);
          return (
            <React.Fragment key={group.key}>
              <div className="sticky top-0 z-10 -mx-4 mb-1 flex items-center gap-2 border-b border-border bg-card px-4 py-1.5">
                <button
                  onClick={() => toggleDayGroup(group.key)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  {group.label}
                  <span className="ml-1 text-muted-foreground/60">· {group.items.length} 条</span>
                </button>
              </div>
              {!isCollapsed && group.items.map((create) => {
              const cfg = statusConfig[create.status] || statusConfig.draft;
              const Icon = cfg.icon;
              const capLabel = capabilities.find((c) => c.slug === create.capabilitySlug)?.name || create.capabilitySlug;
              return (
                <div
                  key={create.id}
                  data-testid="create-card"
                  data-create-id={create.id}
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
                    {(create.status === 'processing' || create.taskStatus === 'submitting' || create.taskStatus === 'queued') && create.taskId && (
                      <button
                        onClick={() => handleCancelTask(create)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                        取消
                      </button>
                    )}
                  </div>

                  <p className={`text-sm text-foreground mb-1 ${expandedIds.has(create.id) ? '' : 'line-clamp-2'}`}>
                    {create.prompt}
                  </p>

                  {create.status === 'processing' && (
                    <Progress value={create.taskProgress} size="slim" className="mt-2" />
                  )}

                  {create.status === 'failed' && create.errorMessage && (
                    <p className="text-xs text-destructive mt-2">{create.errorMessage}</p>
                  )}

                  {create.status === 'completed' && create.output && (
                    <div className="mt-2 rounded-lg bg-background p-3">
                      {create.capabilitySlug === 'image-generation' || create.capabilitySlug === 'background-removal' || create.capabilitySlug === 'scene-composition' || create.capabilitySlug === 'model-dressing' || create.capabilitySlug === 'image-editing' ? (
                        <div className="grid grid-cols-2 gap-2">
                        {(create.output as { images?: Array<{ url: string }> | string[] }).images?.map((img, i: number) => {
                          const url = typeof img === 'string' ? img : img.url;
                          return (
                            <button key={i} onClick={() => setLightboxUrl(url)} className="group relative overflow-hidden rounded-md">
                              <img src={url} alt="" className="h-32 w-full rounded-md object-cover transition-transform group-hover:scale-105" loading="lazy" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                                <Maximize2 className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                              </div>
                            </button>
                          );
                        })}
                        </div>
                      ) : create.capabilitySlug === 'video-generation' || create.capabilitySlug === 'style-cloning' ? (
                        (create.output as { video?: { url: string } | string }).video ? (
                          <video src={typeof create.output.video === 'string' ? create.output.video : (create.output as { video: { url: string } }).video.url} controls className="max-h-48 rounded" />
                        ) : null
                      ) : (
                        (() => {
                          const textContent = (create.output as { content?: string; text?: string }).content
                            || (create.output as { text?: string }).text
                            || JSON.stringify(create.output, null, 2);
                          const isExpanded = expandedIds.has(create.id);
                          return (
                            <>
                              <p className={`text-xs text-foreground whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-5'}`}>
                                {textContent}
                              </p>
                              {textContent.length > 200 && (
                                <button
                                  onClick={() => toggleExpanded(create.id)}
                                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  {isExpanded ? '收起' : '展开全文'}
                                </button>
                              )}
                            </>
                          );
                        })()
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(create.createdAt).toLocaleString('zh-CN')}
                    </p>
                    {create.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        {publishedIdsRef.current.has(create.id) ? (
                          <>
                            <span className="rounded-md bg-brand/10 px-2 py-1 text-xs text-brand">
                              ✓ 已发布
                            </span>
                            <button
                              onClick={() => window.open('/gallery', '_blank')}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            >
                              查看画廊
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handlePublish(create)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                          >
                            <Share2 className="h-3 w-3" />
                            发布
                          </button>
                        )}
                        <button
                          onClick={() => handleModify(create)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                        >
                          <GitBranch className="h-3 w-3" />
                          基于此修改
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </React.Fragment>
          );
        });
      })()
          )}
          </div>
          {showJumpToLatest && creates.length > 0 && (
            <button
              onClick={() => scrollToLatest()}
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg hover:bg-surface-hover hover:text-foreground"
            >
              <ArrowDown className="h-3 w-3" />
              回到最新
            </button>
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
          {uploadedFile && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <img
                src={uploadedFile.previewUrl}
                alt={uploadedFile.name}
                className="h-12 w-12 rounded-md object-cover border border-border"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">已上传，将作为参考图</p>
              </div>
              <button
                onClick={clearUploadedFile}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                aria-label="移除图片"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {/* Auto-detect badge for image tab */}
          {activeTab === 'image' && selectedModelSlug && prompt.trim() && (
            <div className="mb-2 flex items-center gap-1">
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
                {capabilities.find((c) => c.slug === resolvedCapability)?.name || '图片'}
              </span>
              <span className="text-xs text-muted-foreground">
                (基于输入内容自动识别)
              </span>
            </div>
          )}
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="workspace-model" className="text-xs font-medium text-muted-foreground">模型</label>
            {modelLoading ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />加载中</span>
            ) : modelError ? (
              <span className="text-xs text-destructive">模型加载失败</span>
            ) : models.length === 0 ? (
              <span className="text-xs text-muted-foreground">当前能力暂无可用模型</span>
            ) : (
              <>
                <select
                  id="workspace-model"
                  aria-label="模型"
                  value={selectedModelSlug}
                  onChange={(event) => setSelectedModelSlug(event.target.value)}
                  disabled={submitting}
                  className="h-9 min-w-52 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                >
                  {models.map((model) => <option key={model.slug} value={model.slug}>{model.name}</option>)}
                </select>
                {models.find((model) => model.slug === selectedModelSlug) && (
                  <span className="text-xs text-muted-foreground">
                    {models.find((model) => model.slug === selectedModelSlug)?.costCredits} 积分/次
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3 items-end">
            {supportsImageUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || submitting}
                  aria-label="上传参考图"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={supportsImageUpload ? '输入提示词，可上传参考图，按 Enter 发送...' : '输入提示词，按 Enter 发送...'}
              rows={2}
              className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none transition-all duration-150"
            />
            <Button
              variant="brand"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleSubmit}
              disabled={!prompt.trim() || submitting || modelLoading || Boolean(modelError) || models.length === 0 || !selectedModelSlug}
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

      {/* Right: Info Panel */}
      {infoCollapsed ? (
        <div className="hidden w-11 shrink-0 border-l border-border lg:flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setInfoCollapsed(false)}
            aria-label="展开创作信息"
            title="展开创作信息"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : (
      <div className="hidden w-72 shrink-0 border-l border-border p-4 lg:block">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">创作信息</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setInfoCollapsed(true)}
            aria-label="收起创作信息"
            title="收起创作信息"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">当前能力</span>
            <p className="mt-1">{capabilities.find((c) => c.slug === resolvedCapability)?.name || resolvedCapability}</p>
            {activeTab === 'image' && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
                自动识别: {capabilities.find((c) => c.slug === resolvedCapability)?.name || resolvedCapability}
              </div>
            )}
          </div>
          {project && (
            <div>
              <span className="font-medium text-foreground">项目</span>
              <p className="mt-1">{project.name}</p>
            </div>
          )}
          <div>
            <span className="font-medium text-foreground">创作数</span>
            <p className="mt-1">{creates.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs leading-relaxed">
              提示词越具体，生成效果越好。支持中英文输入。
              {supportsImageUpload && ' 当前能力支持上传参考图，点击回形针按钮选择图片。'}
              {sourceCreateId && ' 当前为修改模式，将基于之前的创作结果进行迭代。'}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={lightboxUrl} alt="放大查看" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-lg text-muted-foreground hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-brand" />}
          {toast.type === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
          {toast.type === 'info' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <span className="text-sm text-foreground">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
