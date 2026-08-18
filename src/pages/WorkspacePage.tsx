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
import { ReferenceImageStack, type UploadedRefImage } from '@/components/ReferenceImageStack';
import { RoleImageSlots } from '@/components/RoleImageSlots';
import { ReferenceVideoSlot, type UploadedRefVideo } from '@/components/ReferenceVideoSlot';

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
  { slug: 'image-editing', name: '图片编辑', icon: 'wand-2', category: 'image' },
  { slug: 'background-removal', name: '白底图', icon: 'crop', category: 'image' },
  { slug: 'scene-composition', name: '场景合成', icon: 'layers', category: 'image' },
  { slug: 'model-dressing', name: '模特换装', icon: 'shirt', category: 'image' },
  { slug: 'detail-page-generation', name: '详情页', icon: 'file-text', category: 'text' },
  { slug: 'style-cloning', name: '风格克隆', icon: 'clapperboard', category: 'video' },
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
  { slug: 'image-editing', label: '图片编辑', icon: Wand2, color: 'text-brand' },
  { slug: 'background-removal', label: '白底图', icon: ImageIcon, color: 'text-muted-foreground' },
  { slug: 'scene-composition', label: '场景合成', icon: ImageIcon, color: 'text-brand' },
  { slug: 'model-dressing', label: '模特换装', icon: ImageIcon, color: 'text-primary' },
  { slug: 'detail-page-generation', label: '详情页', icon: FileText, color: 'text-foreground' },
  { slug: 'style-cloning', label: '风格克隆', icon: Clapperboard, color: 'text-foreground' },
];

// 图片类能力（输出图片）：详情恢复 / 发布 / 能力选择共用，防止集合漂移
export const IMAGE_OUTPUT_CAPABILITIES = [
  'image-generation',
  'image-editing',
  'background-removal',
  'scene-composition',
  'model-dressing',
];

// 图片能力参考图槽位语义（对齐 specs/gateway.spec.yaml AICapability.inputSchema.refImageRoles）
// 用户在图片 Tab 手动选择能力时，上传参考图按槽位顺序分配 role；
// 自动识别模式不分配 role（系统猜测的能力不标记用户图片，保持无 role 通用数组契约）
interface RefImageRole { role: string; label: string; max: number }
export const REF_IMAGE_ROLES: Record<string, RefImageRole[]> = {
  'image-generation': [],
  'image-editing': [{ role: 'target', label: '编辑目标图', max: 1 }],
  'background-removal': [{ role: 'subject', label: '商品图', max: 1 }],
  'scene-composition': [
    { role: 'product', label: '商品图', max: 1 },
    { role: 'scene', label: '场景图', max: 1 },
  ],
  'model-dressing': [
    { role: 'model', label: '模特图', max: 1 },
    { role: 'garment', label: '衣服图', max: 1 },
  ],
};


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

// Spec selector: renders model-specific parameter controls (size, ratio, quality, etc.)
function SpecSelect({ model, value, onChange }: {
  model: GatewayModelSummary | undefined;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  if (!model) return null;
  const constraints = (model as any).constraints as Record<string, unknown> | undefined;
  if (!constraints) return null;

  // Image model specs: sizes
  const sizes = constraints.sizes as string[] | undefined;
  if (sizes && sizes.length > 0 && model.modality === 'image') {
    const current = value.size || (model as any).defaultParams?.size || sizes[0];
    return (
      <select
        value={current}
        onChange={(e) => onChange({ ...value, size: e.target.value })}
        className="h-9 min-w-24 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
        aria-label="规格"
      >
        {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  // Image model: aspect_ratio + quality (gpt-image-2 style)
  const ratios = constraints.ratios as string[] | undefined;
  if (ratios && model.modality === 'image') {
    const current = value.ratio || (model as any).defaultParams?.aspect_ratio || ratios[0];
    return (
      <select
        value={current}
        onChange={(e) => onChange({ ...value, ratio: e.target.value })}
        className="h-9 min-w-24 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
        aria-label="画面比例"
      >
        {ratios.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    );
  }

  // Video model: ratio + resolution + duration
  if (model.modality === 'video') {
    const videoRatios = constraints.ratios as string[] | undefined;
    const resolutions = constraints.resolutions as string[] | undefined;
    const maxDur = constraints.maxDuration as number | undefined;
    const minDur = constraints.minDuration as number | undefined;
    const curRatio = value.ratio || (model as any).defaultParams?.ratio || videoRatios?.[0] || '16:9';
    const curRes = value.resolution || (model as any).defaultParams?.resolution || resolutions?.[0] || '720p';
    const curDur = value.duration || String((model as any).defaultParams?.duration || 5);
    return (
      <div className="flex items-center gap-1">
        <select
          value={curRatio}
          onChange={(e) => onChange({ ...value, ratio: e.target.value })}
          className="h-9 min-w-20 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
          aria-label="比例"
        >
          {videoRatios?.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={curRes}
          onChange={(e) => onChange({ ...value, resolution: e.target.value })}
          className="h-9 min-w-20 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
          aria-label="分辨率"
        >
          {resolutions?.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={curDur}
          onChange={(e) => onChange({ ...value, duration: e.target.value })}
          className="h-9 min-w-16 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
          aria-label="时长"
        >
          {Array.from({ length: (maxDur || 12) - (minDur || 4) + 1 }, (_, i) => String((minDur || 4) + i)).map((d) => (
            <option key={d} value={d}>{d}s</option>
          ))}
        </select>
      </div>
    );
  }

  return null;
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
  // 图片 Tab 手动选择的能力（null = 自动识别）；选能力后模型列表按 capability 过滤，参考图按 refImageRoles 分配 role
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [models, setModels] = useState<GatewayModelSummary[]>([]);
  const [selectedModelSlug, setSelectedModelSlug] = useState('');
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sourceCreateId, setSourceCreateId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedRefImage[]>([]);
  const [uploading, setUploading] = useState(false);
  // 风格克隆参考视频（独立契约字段 referenceVideos:[{fileId}]，非参考图 role）
  const [uploadedVideo, setUploadedVideo] = useState<UploadedRefVideo | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [specParams, setSpecParams] = useState<Record<string, string>>({});
  const [collapsedDayGroups, setCollapsedDayGroups] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  // 槽位模式：点击某角色槽后记录 pendingRole，文件选择落地到该槽（单张替换语义）
  const pendingRoleRef = useRef<string | null>(null);
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
      ? (selectedCapability ? `capability=${encodeURIComponent(selectedCapability)}` : `modality=image`)
      : activeTab === 'video-generation'
        ? (selectedCapability ? `capability=${encodeURIComponent(selectedCapability)}` : `capability=video-generation`)
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
  }, [activeTab, selectedCapability]);

  // Clear uploaded file when switching to a non-image-upload capability
  useEffect(() => {
    if (!imageUploadCapabilities.includes(activeTab) && uploadedFiles.length > 0) {
      clearUploadedFiles();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve actual capability slug: image tab uses manual selection (if any) or auto-detects; others use tab slug directly
  useEffect(() => {
    if (activeTab === 'image') {
      if (selectedCapability) {
        setResolvedCapability(selectedCapability);
        return;
      }
      const hasRef = uploadedFiles.length > 0;
      const modelCaps = models.find((m) => m.slug === selectedModelSlug)?.capabilities || ['image-generation'];
      setResolvedCapability(detectImageCapability(prompt, hasRef, modelCaps));
    } else if (activeTab === 'video-generation') {
      setResolvedCapability(selectedCapability ?? 'video-generation');
    } else {
      setResolvedCapability(activeTab);
    }
  }, [activeTab, prompt, uploadedFiles, selectedModelSlug, models, selectedCapability]);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting || modelLoading || Boolean(modelError) || !selectedModelSlug || models.length === 0) return;
    setSubmitting(true);

    try {
      const input: Record<string, unknown> = { prompt: prompt.trim() };
      if (uploadedFiles.length > 0) {
        input.referenceImages = uploadedFiles.map((f) => (f.role ? { role: f.role, fileId: f.fileId } : { fileId: f.fileId }));
      }
      if (selectedCapability === 'style-cloning' && uploadedVideo) {
        input.referenceVideos = [{ fileId: uploadedVideo.fileId }];
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
        clearUploadedFiles();
        clearUploadedVideo();
        // Add optimistic create to the list
        const capInfo = capabilities.find((c) => c.slug === resolvedCapability);
        if (data?.data?.createId) {
          setCreates((prev) => [...prev, {
            id: data.data.createId,
            capabilitySlug: resolvedCapability,
            prompt: prompt.trim(),
            input: uploadedFiles.length > 0
              ? { prompt: prompt.trim(), referenceImages: uploadedFiles.map((f) => (f.role ? { role: f.role, fileId: f.fileId } : { fileId: f.fileId })) }
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
    const isImage = IMAGE_OUTPUT_CAPABILITIES.includes(create.capabilitySlug);
    setActiveTab(isImage ? 'image' : create.capabilitySlug);
    // 图片创作修改：能力选择器对齐快照能力（模型列表按能力过滤 + 参考图槽位呈现）
    if (isImage) setSelectedCapability(create.capabilitySlug);
    // 恢复参考图：新快照 referenceImages 数组优先（服务端 resolveMediaUrls 已注入 url），
    // 遗留单图 referenceImage 快照回退按需 GET（与改造前行为一致）
    const refInput = create.input as {
      referenceImages?: Array<{ fileId: string; url?: string; role?: string }>;
      referenceImage?: { fileId?: string; url?: string };
    } | null;
    const refImages = refInput?.referenceImages;
    if (refImages?.length) {
      setUploadedFiles(
        refImages
          .filter((r) => r.fileId)
          .map((r) => ({ fileId: r.fileId, previewUrl: r.url ?? '', name: '原参考图', ...(r.role ? { role: r.role } : {}) })),
      );
      // 乐观本地条目（无 url）按需回源
      const missing = refImages.filter((r) => r.fileId && !r.url);
      for (const m of missing) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        apiFetch(`/api/storage/files/${m.fileId}`)
          .then(async (res) => {
            if (!res.ok) return;
            const file = await res.json() as { id: string; url: string; originalName: string };
            if (file.url) {
              setUploadedFiles((prev) => prev.map((f) => (f.fileId === file.id ? { ...f, previewUrl: file.url, name: file.originalName || '原参考图' } : f)));
            }
          })
          .catch(() => { /* 预览失败不阻塞修改流程 */ });
      }
    } else if (refInput?.referenceImage?.fileId) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      apiFetch(`/api/storage/files/${refInput.referenceImage.fileId}`)
        .then(async (res) => {
          if (!res.ok) return;
          const file = await res.json() as { id: string; url: string; originalName: string };
          if (file.url) {
            setUploadedFiles([{ fileId: file.id, previewUrl: file.url, name: file.originalName || '原参考图' }]);
          }
        })
        .catch(() => { /* 预览失败不阻塞修改流程 */ });
    }

    // 风格克隆参考视频恢复（快照 referenceVideos 数组优先，服务端注入 url；遗留无 url 按需 GET）
    const refVideos = (create.input as { referenceVideos?: Array<{ fileId: string; url?: string }> } | null)?.referenceVideos;
    if (refVideos?.length && refVideos[0].fileId) {
      const first = refVideos[0];
      if (first.url) {
        setUploadedVideo({ fileId: first.fileId, previewUrl: first.url, name: '原参考视频' });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        apiFetch(`/api/storage/files/${first.fileId}`)
          .then(async (res) => {
            if (!res.ok) return;
            const file = await res.json() as { id: string; url: string; originalName: string };
            if (file.url) setUploadedVideo({ fileId: file.id, previewUrl: file.url, name: file.originalName || '原参考视频' });
          })
          .catch(() => { /* 预览失败不阻塞修改流程 */ });
      }
    }
  };

  // Capabilities that accept a reference image
  const imageUploadCapabilities = ['image'];
  const supportsImageUpload = imageUploadCapabilities.includes(activeTab);

  // 槽位模式：手动选择的能力定义了 refImageRoles 时，参考图按角色槽位渲染/分配
  const activeRefRoles = selectedCapability ? REF_IMAGE_ROLES[selectedCapability] ?? [] : [];
  const showRoleSlots = activeTab === 'image' && activeRefRoles.length > 0;

  const MAX_REF_IMAGES = 9;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    // 槽位模式：单张消费 pendingRole（替换该槽已有图）
    const roleOverride = pendingRoleRef.current;
    if (roleOverride) {
      pendingRoleRef.current = null;
      const file = selected[0];
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        showToast('error', '仅支持 10MB 以内的图片');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'temp');
        const uploadRes = await apiFetch('/api/storage/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        const upload = uploadData.data ?? uploadData;
        if (uploadRes.ok && upload.id) {
          // 替换语义：移除该角色已有图后落入新图
          setUploadedFiles((prev) => [...prev.filter((f) => f.role !== roleOverride), { fileId: upload.id, previewUrl, name: file.name, role: roleOverride }]);
          showToast('success', `${file.name} 已作为${activeRefRoles.find((r) => r.role === roleOverride)?.label ?? '参考图'}`);
        } else {
          URL.revokeObjectURL(previewUrl);
          showToast('error', '图片上传失败');
        }
      } catch {
        URL.revokeObjectURL(previewUrl);
        showToast('error', '网络错误');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    // 累计上限：堆叠总数不超过 maxImages，多余截断
    const remaining = Math.max(MAX_REF_IMAGES - uploadedFiles.length, 0);
    const accepted = selected.slice(0, remaining);
    if (accepted.length === 0) {
      showToast('info', `最多上传 ${MAX_REF_IMAGES} 张参考图`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.length > remaining) {
      showToast('info', `最多上传 ${MAX_REF_IMAGES} 张参考图，已保留前 ${accepted.length} 张`);
    }

    setUploading(true);
    const targetTab = activeTab; // 上传中切 tab 则中止，不落地错 tab 图片
    const targetCapability = selectedCapability; // 上传中切能力则中止，避免 role 错标
    let failed = 0;
    let uploaded = 0;

    try {
      for (const file of accepted) {
        // 类型/大小校验：跳过继续（不中断整批）
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
          failed += 1;
          continue;
        }

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
              // 上传中切 tab/能力：中止循环，丢弃已完成项
              if (activeTab !== targetTab || selectedCapability !== targetCapability) break;
              setUploadedFiles((prev) => {
                // 手动选择能力时按槽位顺序分配 role（第 N 张 → roles[N-1]）；自动识别/无槽位定义 → 无 role
                const roles = selectedCapability ? REF_IMAGE_ROLES[selectedCapability] ?? [] : [];
                const role = roles[prev.length]?.role;
                return [...prev, { fileId, previewUrl, name: file.name, ...(role ? { role } : {}) }];
              });
              uploaded += 1;
            } else {
              failed += 1;
              URL.revokeObjectURL(previewUrl);
            }
          } else {
            failed += 1;
            URL.revokeObjectURL(previewUrl);
          }
        } catch {
          failed += 1;
          URL.revokeObjectURL(previewUrl);
        }
      }
    } finally {
      setUploading(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    if (uploaded > 0 && failed === 0) {
      showToast('success', uploaded === 1 ? '图片已上传' : `已上传 ${uploaded} 张参考图`);
    } else if (failed > 0) {
      showToast('error', `${failed} 张图片上传失败`);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    if (!file.type.startsWith('video/')) {
      showToast('error', '仅支持视频文件');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast('error', '参考视频不能超过 50MB');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setVideoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'temp');
      const uploadRes = await apiFetch('/api/storage/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      const upload = uploadData.data ?? uploadData;
      if (uploadRes.ok && upload.id) {
        setUploadedVideo({ fileId: upload.id, previewUrl, name: file.name });
        showToast('success', '参考视频已上传');
      } else {
        URL.revokeObjectURL(previewUrl);
        showToast('error', '视频上传失败');
      }
    } catch {
      URL.revokeObjectURL(previewUrl);
      showToast('error', '网络错误');
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const clearUploadedVideo = () => {
    if (uploadedVideo) URL.revokeObjectURL(uploadedVideo.previewUrl);
    setUploadedVideo(null);
  };

  const clearUploadedFiles = () => {
    uploadedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setUploadedFiles([]);
  };

  const removeUploadedFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const removed = prev.find((f) => f.fileId === fileId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((f) => f.fileId !== fileId);
    });
  };

  const handlePublish = async (create: Create) => {
    const output = create.output as Record<string, unknown> | null;
    const isImage = IMAGE_OUTPUT_CAPABILITIES.includes(create.capabilitySlug);
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
    <>
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

        {/* Input Area: [Mode | 参考图+Prompt | Model+Spec+发送] */}
        <div className="border-t border-border bg-card">
          <div className="flex items-stretch">
            {/* Mode selector (vertical, inside input area) */}
            <div className="flex shrink-0 flex-col gap-0.5 border-r border-border p-2">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.slug;
                return (
                  <button
                    key={tab.slug}
                    onClick={() => {
                      setActiveTab(tab.slug);
                      // 切换 tab 时清除已上传参考图（避免残留不同能力）
                      clearUploadedFiles();
                    }}
                    title={tab.label}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : tab.color}`} />
                  </button>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-1 flex-col p-3">
              {/* Row 1: 参考图 (left stack) + Prompt (right flex-1) */}
              <div className="flex items-stretch gap-3">
                {/* 参考图：手动选能力 → 角色槽位；否则多图堆叠（折叠 → hover 扇形展开） */}
                <div className="relative flex shrink-0 flex-col items-center justify-center overflow-visible">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  {activeTab === 'video-generation' && selectedCapability === 'style-cloning' && (
                    <ReferenceVideoSlot
                      video={uploadedVideo}
                      uploading={videoUploading}
                      disabled={submitting}
                      onSelect={() => videoInputRef.current?.click()}
                      onRemove={clearUploadedVideo}
                    />
                  )}
                  {supportsImageUpload && showRoleSlots && selectedCapability ? (
                    <RoleImageSlots
                      files={uploadedFiles}
                      roles={activeRefRoles}
                      uploading={uploading}
                      disabled={submitting}
                      onAdd={(role) => {
                        pendingRoleRef.current = role;
                        fileInputRef.current?.click();
                      }}
                      onRemove={removeUploadedFile}
                    />
                  ) : supportsImageUpload ? (
                    <ReferenceImageStack
                      files={uploadedFiles}
                      uploading={uploading}
                      disabled={submitting}
                      onAdd={() => fileInputRef.current?.click()}
                      onRemove={removeUploadedFile}
                      onClear={clearUploadedFiles}
                    />
                  ) : null}
                </div>

                {/* Prompt input (flex-1) */}
                <div className="min-w-0 flex-1">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={supportsImageUpload ? '输入提示词，可上传参考图，按 Enter 发送...' : '输入提示词，按 Enter 发送...'}
                    rows={3}
                    className="h-full w-full min-h-[64px] resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-150"
                  />
                </div>
              </div>

              {/* Row 2: 能力选择 + Model + Spec + cost + 发送 */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* 能力选择（图片 Tab：自动识别 或 手动选择能力；选后模型按能力过滤、参考图按槽位分配 role） */}
                {activeTab === 'image' && (
                  <>
                    <select
                      aria-label="图片能力"
                      value={selectedCapability ?? ''}
                      onChange={(event) => {
                        const next = event.target.value || null;
                        setSelectedCapability(next);
                        // 能力切换 → 参考图槽位语义变化，清空已上传图避免角色错位
                        clearUploadedFiles();
                        setSpecParams({});
                      }}
                      className="h-9 shrink-0 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                    >
                      <option value="">自动识别（{capabilities.find((c) => c.slug === resolvedCapability)?.name || '图片'}）</option>
                      {IMAGE_OUTPUT_CAPABILITIES.map((slug) => (
                        <option key={slug} value={slug}>
                          {capabilities.find((c) => c.slug === slug)?.name || slug}
                        </option>
                      ))}
                    </select>
                    {/* 槽位语义提示：手动选能力且有槽位定义时说明每张图用途 */}
                    {selectedCapability && (REF_IMAGE_ROLES[selectedCapability]?.length ?? 0) > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {REF_IMAGE_ROLES[selectedCapability].map((r) => `${r.label}${r.max > 1 ? `≤${r.max}张` : ''}`).join(' + ')}
                      </span>
                    )}
                  </>
                )}

                {/* 能力选择（视频 Tab：视频生成 / 风格克隆；风格克隆需参考视频） */}
                {activeTab === 'video-generation' && (
                  <select
                    aria-label="视频能力"
                    value={selectedCapability ?? ''}
                    onChange={(event) => {
                      const next = event.target.value || null;
                      setSelectedCapability(next);
                      clearUploadedVideo();
                    }}
                    className="h-9 shrink-0 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                  >
                    <option value="">自动识别（{resolvedCapability === 'style-cloning' ? '风格克隆' : '视频生成'}）</option>
                    <option value="video-generation">视频生成</option>
                    <option value="style-cloning">风格克隆</option>
                  </select>
                )}

                {/* Model selector */}
                {modelLoading ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />加载中</span>
                ) : modelError ? (
                  <span className="text-xs text-destructive">模型加载失败</span>
                ) : models.length === 0 ? (
                  <span className="text-xs text-muted-foreground">当前能力暂无可用模型</span>
                ) : (
                  <select
                    id="workspace-model"
                    aria-label="模型"
                    value={selectedModelSlug}
                    onChange={(event) => {
                      setSelectedModelSlug(event.target.value);
                      // 模型切换后重置 Spec 到默认
                      setSpecParams({});
                    }}
                    disabled={submitting}
                    className="h-9 min-w-40 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                  >
                    {models.map((model) => <option key={model.slug} value={model.slug}>{model.name}</option>)}
                  </select>
                )}
                {models.find((model) => model.slug === selectedModelSlug) && !modelLoading && !modelError && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {models.find((model) => model.slug === selectedModelSlug)?.costCredits} 积分/次
                  </span>
                )}

                {/* Spec selector (model constraints driven) */}
                <SpecSelect
                  model={models.find((m) => m.slug === selectedModelSlug)}
                  value={specParams}
                  onChange={setSpecParams}
                />

                <div className="flex-1" />

                <Button
                  variant="brand"
                  size="icon"
                  className="h-9 w-9 shrink-0"
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

              {/* sourceCreateId indicator */}
              {sourceCreateId && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
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
            </div>
          </div>
        </div>
      </div>
    </div>

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
    </>
  );
}
