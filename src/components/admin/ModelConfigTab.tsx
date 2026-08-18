import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ServerCog,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAuthHeaders } from './types';

type ViewMode = 'models' | 'platforms' | 'channels' | 'routes';

type SdkClient = 'llm' | 'image' | 'video' | 'replicate' | 'openai';

interface ConfiguredModel {
  id: string;
  slug: string;
  name: string;
  modality: 'llm' | 'image' | 'video';
  capabilities: string[];
  description: string | null;
  outputType: string;
  costCredits: number;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  defaultParams?: Record<string, unknown>;
}

interface ConfiguredPlatform {
  id: string;
  name: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  isActive: boolean;
}

interface ConfiguredChannel {
  id: string;
  platformId: string;
  platformName: string;
  modelSlug: string;
  sdkClient: SdkClient;
  sdkModelId: string;
  priority: number;
  costPerCall: string | null;
  costPerSecond: string | null;
  config: Record<string, unknown>;
  apiKeyConfigured: boolean;
  isActive: boolean;
}

interface ConfiguredRoute {
  id: string;
  capabilitySlug: string;
  modelSlug: string;
  priority: number;
  isActive: boolean;
}

interface CapabilitySummary {
  slug: string;
  name: string;
  sortOrder: number;
}

interface ModelConfiguration {
  models: ConfiguredModel[];
  platforms: ConfiguredPlatform[];
  channels: ConfiguredChannel[];
  routes: ConfiguredRoute[];
  capabilities: CapabilitySummary[];
}

interface ModelForm {
  slug: string;
  name: string;
  modality: ConfiguredModel['modality'];
  capabilities: string;
  description: string;
  outputType: string;
  costCredits: string;
  sortOrder: string;
  baseUrl: string;
  timeoutMs: string;
  size: string;
  n: string;
  temperature: string;
  maxTokens: string;
}

interface PlatformForm {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyConfigured: boolean;
}

interface ChannelForm {
  platformId: string;
  modelSlug: string;
  sdkClient: SdkClient;
  sdkModelId: string;
  priority: string;
  costPerCall: string;
  costPerSecond: string;
  baseUrl: string;
  apiKey: string;
  apiKeyConfigured: boolean;
  copyFromId: string;
  copyFromName: string;
}

const emptyConfiguration: ModelConfiguration = {
  models: [],
  platforms: [],
  channels: [],
  routes: [],
  capabilities: [],
};

const emptyModelForm: ModelForm = {
  slug: '',
  name: '',
  modality: 'image',
  capabilities: '',
  description: '',
  outputType: 'image',
  costCredits: '1',
  sortOrder: '0',
  baseUrl: '',
  timeoutMs: '',
  size: '',
  n: '',
  temperature: '',
  maxTokens: '',
};

const emptyPlatformForm: PlatformForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  apiKeyConfigured: false,
};

const emptyChannelForm: ChannelForm = {
  platformId: '',
  modelSlug: '',
  sdkClient: 'image',
  sdkModelId: '',
  priority: '1',
  costPerCall: '',
  costPerSecond: '',
  baseUrl: '',
  apiKey: '',
  apiKeyConfigured: false,
  copyFromId: '',
  copyFromName: '',
};

async function parseError(response: Response): Promise<string> {
  const result = await response.json().catch(() => null) as { message?: string } | null;
  return result?.message ?? '操作失败';
}

function KeyBadge({ configured }: { configured: boolean }) {
  return configured ? <Badge variant="brand">已配置</Badge> : <Badge variant="warning">未配置</Badge>;
}

export default function ModelConfigTab() {
  const [view, setView] = useState<ViewMode>('models');
  const [configuration, setConfiguration] = useState<ModelConfiguration>(emptyConfiguration);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModelSlug, setEditingModelSlug] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState<ModelForm>(emptyModelForm);

  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [platformForm, setPlatformForm] = useState<PlatformForm>(emptyPlatformForm);

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelForm>(emptyChannelForm);

  const [selectedCapability, setSelectedCapability] = useState('');
  const [routeModelSlugs, setRouteModelSlugs] = useState<string[]>([]);
  const [routeCandidate, setRouteCandidate] = useState('');

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/model-config', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const result = await response.json() as { data?: ModelConfiguration } | ModelConfiguration;
      const data = 'data' in result && result.data ? result.data : result as ModelConfiguration;
      setConfiguration(data);
      setSelectedCapability((current) => current || data.capabilities[0]?.slug || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '模型配置加载失败');
      setConfiguration(emptyConfiguration);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    const slugs = configuration.routes
      .filter((route) => route.capabilitySlug === selectedCapability && route.isActive)
      .sort((a, b) => a.priority - b.priority)
      .map((route) => route.modelSlug);
    setRouteModelSlugs(slugs);
    setRouteCandidate('');
  }, [configuration.routes, selectedCapability]);

  const availableRouteModels = useMemo(() => configuration.models.filter((model) => (
    model.isActive
    && model.capabilities.includes(selectedCapability)
    && !routeModelSlugs.includes(model.slug)
  )), [configuration.models, routeModelSlugs, selectedCapability]);

  // 渠道按平台分组，保持平台首次出现顺序
  const channelGroups = useMemo(() => {
    const groups = new Map<string, ConfiguredChannel[]>();
    for (const channel of configuration.channels) {
      const list = groups.get(channel.platformName) ?? [];
      list.push(channel);
      groups.set(channel.platformName, list);
    }
    return Array.from(groups.entries());
  }, [configuration.channels]);

  const platformById = useMemo(
    () => new Map(configuration.platforms.map((platform) => [platform.id, platform])),
    [configuration.platforms],
  );

  const mutate = async (path: string, method: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await parseError(response));
      await loadConfiguration();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ===== 模型 =====

  const openCreateModel = () => {
    setEditingModelSlug(null);
    setModelForm(emptyModelForm);
    setModelDialogOpen(true);
  };

  const openEditModel = (model: ConfiguredModel) => {
    const params = model.defaultParams ?? {};
    setEditingModelSlug(model.slug);
    setModelForm({
      slug: model.slug,
      name: model.name,
      modality: model.modality,
      capabilities: model.capabilities.join(', '),
      description: model.description ?? '',
      outputType: model.outputType,
      costCredits: String(model.costCredits),
      sortOrder: String(model.sortOrder),
      baseUrl: typeof params.baseUrl === 'string' ? params.baseUrl : '',
      timeoutMs: typeof params.timeoutMs === 'number' ? String(params.timeoutMs) : '',
      size: typeof params.size === 'string' ? params.size : '',
      n: typeof params.n === 'number' ? String(params.n) : '',
      temperature: typeof params.temperature === 'number' ? String(params.temperature) : '',
      maxTokens: typeof params.maxTokens === 'number' ? String(params.maxTokens) : '',
    });
    setModelDialogOpen(true);
  };

  const saveModel = async () => {
    const capabilities = modelForm.capabilities.split(',').map((value) => value.trim()).filter(Boolean);
    const defaultParams: Record<string, unknown> = {};
    if (modelForm.baseUrl.trim()) defaultParams.baseUrl = modelForm.baseUrl.trim();
    if (modelForm.timeoutMs.trim()) defaultParams.timeoutMs = Number(modelForm.timeoutMs);
    if (modelForm.size.trim()) defaultParams.size = modelForm.size.trim();
    if (modelForm.n.trim()) defaultParams.n = Number(modelForm.n);
    if (modelForm.temperature.trim()) defaultParams.temperature = Number(modelForm.temperature);
    if (modelForm.maxTokens.trim()) defaultParams.maxTokens = Number(modelForm.maxTokens);
    const body: Record<string, unknown> = {
      ...(!editingModelSlug && { slug: modelForm.slug.trim() }),
      name: modelForm.name.trim(),
      modality: modelForm.modality,
      capabilities,
      description: modelForm.description.trim() || null,
      outputType: modelForm.outputType.trim(),
      costCredits: Number(modelForm.costCredits),
      sortOrder: Number(modelForm.sortOrder),
      ...(Object.keys(defaultParams).length > 0 && { defaultParams }),
    };
    const saved = await mutate(
      editingModelSlug
        ? `/api/admin/model-config/models/${encodeURIComponent(editingModelSlug)}`
        : '/api/admin/model-config/models',
      editingModelSlug ? 'PATCH' : 'POST',
      body,
    );
    if (saved) setModelDialogOpen(false);
  };

  // ===== 平台 =====

  const openCreatePlatform = () => {
    setEditingPlatformId(null);
    setPlatformForm(emptyPlatformForm);
    setPlatformDialogOpen(true);
  };

  const openEditPlatform = (platform: ConfiguredPlatform) => {
    setEditingPlatformId(platform.id);
    setPlatformForm({
      name: platform.name,
      baseUrl: platform.baseUrl ?? '',
      apiKey: '',
      apiKeyConfigured: platform.apiKeyConfigured,
    });
    setPlatformDialogOpen(true);
  };

  const savePlatform = async () => {
    // baseUrl/apiKey 留空 = 不覆盖旧值（key 脱敏无法回显，保持不变的约定）
    const body: Record<string, unknown> = {
      ...(!editingPlatformId && { name: platformForm.name.trim() }),
      ...(platformForm.baseUrl.trim() && { baseUrl: platformForm.baseUrl.trim() }),
      ...(platformForm.apiKey.trim() && { apiKey: platformForm.apiKey.trim() }),
    };
    const saved = await mutate(
      editingPlatformId
        ? `/api/admin/model-config/platforms/${editingPlatformId}`
        : '/api/admin/model-config/platforms',
      editingPlatformId ? 'PATCH' : 'POST',
      body,
    );
    if (saved) setPlatformDialogOpen(false);
  };

  const deletePlatform = async (platform: ConfiguredPlatform) => {
    if (!window.confirm(`删除平台 "${platform.name}" 将同时删除其全部渠道，确认？`)) return;
    const deleted = await mutate(`/api/admin/model-config/platforms/${platform.id}`, 'DELETE', {});
    if (deleted && view === 'channels') setView('platforms');
  };

  // ===== 渠道 =====

  const openCreateChannel = (platformId?: string, source?: ConfiguredChannel) => {
    setEditingChannelId(null);
    const defaultPlatformId = platformId ?? configuration.platforms[0]?.id ?? '';
    setChannelForm({
      ...emptyChannelForm,
      platformId: defaultPlatformId,
      modelSlug: configuration.models[0]?.slug ?? '',
      ...(source
        ? {
          platformId: source.platformId,
          sdkClient: source.sdkClient,
          sdkModelId: source.sdkModelId,
          baseUrl: typeof source.config.baseUrl === 'string' ? source.config.baseUrl : '',
          copyFromId: source.id,
          copyFromName: `${source.platformName} · ${source.sdkModelId}`,
        }
        : {}),
    });
    setChannelDialogOpen(true);
  };

  const openEditChannel = (channel: ConfiguredChannel) => {
    setEditingChannelId(channel.id);
    setChannelForm({
      platformId: channel.platformId,
      modelSlug: channel.modelSlug,
      sdkClient: channel.sdkClient,
      sdkModelId: channel.sdkModelId,
      priority: String(channel.priority),
      costPerCall: channel.costPerCall ?? '',
      costPerSecond: channel.costPerSecond ?? '',
      baseUrl: typeof channel.config.baseUrl === 'string' ? channel.config.baseUrl : '',
      apiKey: '',
      apiKeyConfigured: channel.apiKeyConfigured,
      copyFromId: '',
      copyFromName: '',
    });
    setChannelDialogOpen(true);
  };

  const saveChannel = async () => {
    // config 合并语义：只提交用户填写的字段；后端保留未传字段（含 apiKey）。
    const config: Record<string, unknown> = {};
    if (channelForm.baseUrl.trim()) config.baseUrl = channelForm.baseUrl.trim();
    if (channelForm.apiKey.trim()) config.apiKey = channelForm.apiKey.trim();
    const body: Record<string, unknown> = {
      ...(!editingChannelId && { platformId: channelForm.platformId }),
      ...(!editingChannelId && { modelSlug: channelForm.modelSlug }),
      sdkClient: channelForm.sdkClient,
      sdkModelId: channelForm.sdkModelId.trim(),
      priority: Number(channelForm.priority),
      costPerCall: channelForm.costPerCall === '' ? null : Number(channelForm.costPerCall),
      costPerSecond: channelForm.costPerSecond === '' ? null : Number(channelForm.costPerSecond),
      ...(Object.keys(config).length > 0 && { config }),
      ...(editingChannelId === null && channelForm.copyFromId ? { copyFromId: channelForm.copyFromId } : {}),
    };
    const saved = await mutate(
      editingChannelId
        ? `/api/admin/model-config/channels/${editingChannelId}`
        : '/api/admin/model-config/channels',
      editingChannelId ? 'PATCH' : 'POST',
      body,
    );
    if (saved) setChannelDialogOpen(false);
  };

  const deleteChannel = async (channel: ConfiguredChannel) => {
    if (!window.confirm(`删除渠道 "${channel.modelSlug} @ ${channel.platformName}"，确认？`)) return;
    await mutate(`/api/admin/model-config/channels/${channel.id}`, 'DELETE', {});
  };

  // ===== 路由 =====

  const saveRoutes = async () => {
    const saved = await mutate(
      `/api/admin/model-config/routes/${encodeURIComponent(selectedCapability)}`,
      'PUT',
      { modelSlugs: routeModelSlugs },
    );
    return saved;
  };

  const moveRoute = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= routeModelSlugs.length) return;
    setRouteModelSlugs((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addRouteModel = () => {
    if (!routeCandidate) return;
    setRouteModelSlugs((current) => [...current, routeCandidate]);
    setRouteCandidate('');
  };

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-card p-1" aria-label="模型配置视图">
          {([
            ['models', '模型'],
            ['platforms', '平台'],
            ['channels', '渠道'],
            ['routes', '默认路由'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'models' && <Button size="sm" onClick={openCreateModel}><Plus />新增模型</Button>}
          {view === 'platforms' && <Button size="sm" onClick={openCreatePlatform}><Plus />新增平台</Button>}
          {view === 'channels' && <Button size="sm" onClick={() => openCreateChannel()}><Plus />新增渠道</Button>}
          <Button variant="outline" size="icon" onClick={() => void loadConfiguration()} title="刷新配置">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {view === 'models' && (configuration.models.length === 0 ? (
        <EmptyState icon={ServerCog} title="暂无模型" description="新增逻辑模型后再配置渠道与默认路由" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-hover">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">模型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">能力</th>
                <th className="p-3 text-right font-medium text-muted-foreground">积分成本</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {configuration.models.map((model) => (
                <tr key={model.slug} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{model.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{model.slug}</p>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{model.capabilities.join(', ')}</td>
                  <td className="p-3 text-right font-mono text-foreground">{model.costCredits}</td>
                  <td className="p-3"><Badge variant={model.isActive ? 'brand' : 'default'}>{model.isActive ? '启用' : '停用'}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditModel(model)} aria-label={`编辑 ${model.name}`}><Pencil /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        onClick={() => void mutate(`/api/admin/model-config/models/${encodeURIComponent(model.slug)}/status`, 'PATCH', { isActive: !model.isActive })}
                        aria-label={`${model.isActive ? '停用' : '启用'} ${model.name}`}
                      ><Power /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'platforms' && (configuration.platforms.length === 0 ? (
        <EmptyState icon={ServerCog} title="暂无平台" description="平台存放共享的 Base URL 与 API Key，渠道未覆盖时继承平台配置" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-hover">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">平台</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Base URL</th>
                <th className="p-3 text-left font-medium text-muted-foreground">平台级 Key</th>
                <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {configuration.platforms.map((platform) => (
                <tr key={platform.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{platform.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{platform.baseUrl ?? '—'}</td>
                  <td className="p-3"><KeyBadge configured={platform.apiKeyConfigured} /></td>
                  <td className="p-3"><Badge variant={platform.isActive ? 'brand' : 'default'}>{platform.isActive ? '启用' : '停用'}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditPlatform(platform)} aria-label={`编辑 ${platform.name}`}><Pencil /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        onClick={() => void mutate(`/api/admin/model-config/platforms/${platform.id}/status`, 'PATCH', { isActive: !platform.isActive })}
                        aria-label={`${platform.isActive ? '停用' : '启用'} ${platform.name}`}
                      ><Power /></Button>
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => void deletePlatform(platform)} aria-label={`删除 ${platform.name}`}><Trash2 /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'channels' && (configuration.channels.length === 0 ? (
        <EmptyState icon={ServerCog} title="暂无渠道" description="为平台下的逻辑模型添加可执行渠道" />
      ) : (
        <div className="space-y-4">
          {channelGroups.map(([platformName, channels]) => {
            const platform = configuration.platforms.find((candidate) => candidate.name === platformName);
            return (
              <div key={platformName} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-hover/60 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{platformName}</p>
                    {platform && (
                      <>
                        <Badge variant={platform.isActive ? 'brand' : 'default'}>{platform.isActive ? '启用' : '停用'}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{platform.baseUrl ?? '无默认 Base URL'}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          平台 Key <KeyBadge configured={platform.apiKeyConfigured} />
                        </span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">{channels.length} 个渠道</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCreateChannel(platform?.id)}><Plus />新增渠道</Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface-hover">
                    <tr>
                      <th className="p-3 text-left font-medium text-muted-foreground">逻辑模型</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">SDK Model ID</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">客户端</th>
                      <th className="p-3 text-right font-medium text-muted-foreground">优先级</th>
                      <th className="p-3 text-right font-medium text-muted-foreground">采购成本</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">渠道 Key</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">状态</th>
                      <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => (
                      <tr key={channel.id} className="border-b border-border last:border-0">
                        <td className="p-3 text-foreground">{channel.modelSlug}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{channel.sdkModelId}</td>
                        <td className="p-3"><Badge variant="default">{channel.sdkClient}</Badge></td>
                        <td className="p-3 text-right font-mono text-foreground">{channel.priority}</td>
                        <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                          {channel.costPerCall ? `$${channel.costPerCall}` : '—'}
                          {channel.costPerSecond ? ` / $${channel.costPerSecond}s` : ''}
                        </td>
                        <td className="p-3"><KeyBadge configured={channel.apiKeyConfigured} /></td>
                        <td className="p-3"><Badge variant={channel.isActive ? 'brand' : 'default'}>{channel.isActive ? '启用' : '停用'}</Badge></td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditChannel(channel)} aria-label={`编辑 ${channel.modelSlug} @ ${channel.platformName}`}><Pencil /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openCreateChannel(undefined, channel)} title="复制渠道（含 Key）" aria-label={`复制 ${channel.modelSlug}`}><Copy /></Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={saving}
                              onClick={() => void mutate(`/api/admin/model-config/channels/${channel.id}/status`, 'PATCH', { isActive: !channel.isActive })}
                              aria-label={`${channel.isActive ? '停用' : '启用'} ${channel.modelSlug}`}
                            ><Power /></Button>
                            <Button variant="ghost" size="icon" disabled={saving} onClick={() => void deleteChannel(channel)} aria-label={`删除 ${channel.modelSlug}`}><Trash2 /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}

      {view === 'routes' && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 space-y-1.5">
            <Label htmlFor="route-capability">能力</Label>
            <select
              id="route-capability"
              value={selectedCapability}
              onChange={(event) => setSelectedCapability(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              {configuration.capabilities.map((capability) => (
                <option key={capability.slug} value={capability.slug}>{capability.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-4 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="route-model-candidate">追加模型</Label>
              <select
                id="route-model-candidate"
                value={routeCandidate}
                onChange={(event) => setRouteCandidate(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
              >
                <option value="">选择模型…</option>
                {availableRouteModels.map((model) => (
                  <option key={model.slug} value={model.slug}>{model.name}（{model.slug}）</option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={addRouteModel} disabled={!routeCandidate}><Plus />追加</Button>
          </div>
          <ol className="space-y-2">
            {routeModelSlugs.map((modelSlug, index) => {
              const model = configuration.models.find((candidate) => candidate.slug === modelSlug);
              return (
                <li key={modelSlug} className="flex items-center justify-between rounded-lg border border-border bg-surface-hover/40 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{model?.name ?? modelSlug}</p>
                      <p className="font-mono text-xs text-muted-foreground">{modelSlug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveRoute(index, -1)} aria-label="上移"><span className="sr-only">上移</span>↑</Button>
                    <Button variant="ghost" size="icon" disabled={index === routeModelSlugs.length - 1} onClick={() => moveRoute(index, 1)} aria-label="下移"><span className="sr-only">下移</span>↓</Button>
                    <Button variant="ghost" size="icon" onClick={() => setRouteModelSlugs((current) => current.filter((_, i) => i !== index))} aria-label="移除"><Trash2 /></Button>
                  </div>
                </li>
              );
            })}
            {routeModelSlugs.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">该能力暂无默认路由</li>
            )}
          </ol>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void saveRoutes()} disabled={saving || routeModelSlugs.length === 0}>{saving && <Loader2 className="animate-spin" />}保存路由</Button>
          </div>
        </div>
      )}

      {/* ===== 模型对话框 ===== */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader><DialogTitle>{editingModelSlug ? '编辑模型' : '新增模型'}</DialogTitle><DialogDescription>
          </DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="model-slug">Slug</Label><Input id="model-slug" disabled={Boolean(editingModelSlug)} placeholder="my-model" value={modelForm.slug} onChange={(event) => setModelForm((current) => ({ ...current, slug: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="model-name">名称</Label><Input id="model-name" value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="model-modality">模态</Label><select id="model-modality" value={modelForm.modality} onChange={(event) => setModelForm((current) => ({ ...current, modality: event.target.value as ConfiguredModel['modality'] }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"><option value="llm">llm</option><option value="image">image</option><option value="video">video</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="model-output-type">输出类型</Label><Input id="model-output-type" value={modelForm.outputType} onChange={(event) => setModelForm((current) => ({ ...current, outputType: event.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="model-capabilities">能力（逗号分隔）</Label><Input id="model-capabilities" placeholder="image-generation, image-editing" value={modelForm.capabilities} onChange={(event) => setModelForm((current) => ({ ...current, capabilities: event.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="model-cost-credits">积分成本</Label><Input id="model-cost-credits" type="number" min="0" value={modelForm.costCredits} onChange={(event) => setModelForm((current) => ({ ...current, costCredits: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="model-sort-order">排序</Label><Input id="model-sort-order" type="number" min="0" value={modelForm.sortOrder} onChange={(event) => setModelForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="model-description">描述</Label><Input id="model-description" value={modelForm.description} onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="rounded-lg border border-border bg-surface-hover/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">模型级网关参数（defaultParams，仅业务参数，不含密钥）</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="model-base-url">Base URL</Label><Input id="model-base-url" placeholder="https://api.openai.com/v1" value={modelForm.baseUrl} onChange={(event) => setModelForm((current) => ({ ...current, baseUrl: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label htmlFor="model-timeout">超时（毫秒）</Label><Input id="model-timeout" type="number" min="0" value={modelForm.timeoutMs} onChange={(event) => setModelForm((current) => ({ ...current, timeoutMs: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label htmlFor="model-temperature">温度</Label><Input id="model-temperature" type="number" step="0.1" value={modelForm.temperature} onChange={(event) => setModelForm((current) => ({ ...current, temperature: event.target.value }))} /></div>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => void saveModel()} disabled={saving || !modelForm.name.trim() || !modelForm.capabilities.trim()}>{saving && <Loader2 className="animate-spin" />}保存模型</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 平台对话框 ===== */}
      <Dialog open={platformDialogOpen} onOpenChange={setPlatformDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader><DialogTitle>{editingPlatformId ? '编辑平台' : '新增平台'}</DialogTitle><DialogDescription>
            平台存放共享账号：Base URL 与 API Key 为平台级默认值，渠道未覆盖时继承；留空不覆盖已有值。
          </DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="platform-name">平台名称</Label><Input id="platform-name" disabled={Boolean(editingPlatformId)} placeholder="pptoken" value={platformForm.name} onChange={(event) => setPlatformForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="platform-base-url">Base URL</Label><Input id="platform-base-url" placeholder="https://api.openai.com/v1" value={platformForm.baseUrl} onChange={(event) => setPlatformForm((current) => ({ ...current, baseUrl: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="platform-api-key">API Key（平台级）</Label><Input id="platform-api-key" type="password" autoComplete="new-password" placeholder={platformForm.apiKeyConfigured ? '已配置，留空保持不变' : '未配置，填入后启用'} value={platformForm.apiKey} onChange={(event) => setPlatformForm((current) => ({ ...current, apiKey: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => void savePlatform()} disabled={saving || !platformForm.name.trim()}>{saving && <Loader2 className="animate-spin" />}保存平台</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 渠道对话框 ===== */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader><DialogTitle>{editingChannelId ? '编辑渠道' : '新增渠道'}</DialogTitle><DialogDescription>
            Key 解析：渠道级 &gt; 平台级；均未配置时调用将报错（模型不参与 key 配置）。渠道 baseUrl/apiKey 留空 = 继承平台，留空不覆盖已有值。
            {editingChannelId === null && channelForm.copyFromId && ` 将复制 ${channelForm.copyFromName} 的渠道配置（含 Key）。`}
          </DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="channel-platform">平台</Label><select id="channel-platform" disabled={Boolean(editingChannelId)} value={channelForm.platformId} onChange={(event) => setChannelForm((current) => ({ ...current, platformId: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">{configuration.platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="channel-model">逻辑模型</Label><select id="channel-model" disabled={Boolean(editingChannelId)} value={channelForm.modelSlug} onChange={(event) => setChannelForm((current) => ({ ...current, modelSlug: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">{configuration.models.map((model) => <option key={model.slug} value={model.slug}>{model.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="channel-client">SDK 客户端</Label><select id="channel-client" value={channelForm.sdkClient} onChange={(event) => setChannelForm((current) => ({ ...current, sdkClient: event.target.value as SdkClient }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"><option value="llm">llm</option><option value="image">image</option><option value="video">video</option><option value="replicate">replicate</option><option value="openai">openai</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="channel-sdk-model">SDK Model ID</Label><Input id="channel-sdk-model" value={channelForm.sdkModelId} onChange={(event) => setChannelForm((current) => ({ ...current, sdkModelId: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="channel-priority">优先级</Label><Input id="channel-priority" type="number" min="1" value={channelForm.priority} onChange={(event) => setChannelForm((current) => ({ ...current, priority: event.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="channel-cost-call">单次采购成本</Label><Input id="channel-cost-call" type="number" min="0" step="0.0001" value={channelForm.costPerCall} onChange={(event) => setChannelForm((current) => ({ ...current, costPerCall: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="channel-cost-second">每秒采购成本</Label><Input id="channel-cost-second" type="number" min="0" step="0.0001" value={channelForm.costPerSecond} onChange={(event) => setChannelForm((current) => ({ ...current, costPerSecond: event.target.value }))} /></div>
            </div>
            <div className="rounded-lg border border-border bg-surface-hover/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">渠道级覆盖（config，覆盖平台默认）</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="channel-base-url">Base URL</Label><Input id="channel-base-url" placeholder="留空继承平台" value={channelForm.baseUrl} onChange={(event) => setChannelForm((current) => ({ ...current, baseUrl: event.target.value }))} /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="channel-api-key">API Key（渠道级）</Label>
                  <Input id="channel-api-key" type="password" autoComplete="new-password" placeholder={channelForm.apiKeyConfigured ? '已配置，留空保持不变' : '未配置，填入后启用'} value={channelForm.apiKey} onChange={(event) => setChannelForm((current) => ({ ...current, apiKey: event.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => void saveChannel()} disabled={saving || !channelForm.platformId || !channelForm.modelSlug || !channelForm.sdkModelId.trim()}>{saving && <Loader2 className="animate-spin" />}保存渠道</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
