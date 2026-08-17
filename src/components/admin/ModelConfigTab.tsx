import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
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

type ViewMode = 'models' | 'providers' | 'routes';

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
}

interface ConfiguredProvider {
  id: string;
  modelSlug: string;
  providerName: string;
  sdkClient: 'llm' | 'image' | 'video' | 'replicate';
  sdkModelId: string;
  priority: number;
  costPerCall: string | null;
  costPerSecond: string | null;
  config: Record<string, unknown>;
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
  providers: ConfiguredProvider[];
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
}

interface ProviderForm {
  modelSlug: string;
  providerName: string;
  sdkClient: ConfiguredProvider['sdkClient'];
  sdkModelId: string;
  priority: string;
  costPerCall: string;
  costPerSecond: string;
}

const emptyConfiguration: ModelConfiguration = {
  models: [],
  providers: [],
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
};

const emptyProviderForm: ProviderForm = {
  modelSlug: '',
  providerName: '',
  sdkClient: 'image',
  sdkModelId: '',
  priority: '1',
  costPerCall: '',
  costPerSecond: '',
};

async function parseError(response: Response): Promise<string> {
  const result = await response.json().catch(() => null) as { message?: string } | null;
  return result?.message ?? '操作失败';
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

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm>(emptyProviderForm);

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

  const openCreateModel = () => {
    setEditingModelSlug(null);
    setModelForm(emptyModelForm);
    setModelDialogOpen(true);
  };

  const openEditModel = (model: ConfiguredModel) => {
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
    });
    setModelDialogOpen(true);
  };

  const saveModel = async () => {
    const capabilities = modelForm.capabilities.split(',').map((value) => value.trim()).filter(Boolean);
    const body = {
      ...(!editingModelSlug && { slug: modelForm.slug.trim() }),
      name: modelForm.name.trim(),
      modality: modelForm.modality,
      capabilities,
      description: modelForm.description.trim() || null,
      outputType: modelForm.outputType.trim(),
      costCredits: Number(modelForm.costCredits),
      sortOrder: Number(modelForm.sortOrder),
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

  const openCreateProvider = () => {
    setEditingProviderId(null);
    setProviderForm({ ...emptyProviderForm, modelSlug: configuration.models[0]?.slug ?? '' });
    setProviderDialogOpen(true);
  };

  const openEditProvider = (provider: ConfiguredProvider) => {
    setEditingProviderId(provider.id);
    setProviderForm({
      modelSlug: provider.modelSlug,
      providerName: provider.providerName,
      sdkClient: provider.sdkClient,
      sdkModelId: provider.sdkModelId,
      priority: String(provider.priority),
      costPerCall: provider.costPerCall ?? '',
      costPerSecond: provider.costPerSecond ?? '',
    });
    setProviderDialogOpen(true);
  };

  const saveProvider = async () => {
    const body = {
      ...(!editingProviderId && { modelSlug: providerForm.modelSlug }),
      providerName: providerForm.providerName.trim(),
      sdkClient: providerForm.sdkClient,
      sdkModelId: providerForm.sdkModelId.trim(),
      priority: Number(providerForm.priority),
      costPerCall: providerForm.costPerCall === '' ? null : Number(providerForm.costPerCall),
      costPerSecond: providerForm.costPerSecond === '' ? null : Number(providerForm.costPerSecond),
    };
    const saved = await mutate(
      editingProviderId
        ? `/api/admin/model-config/providers/${editingProviderId}`
        : '/api/admin/model-config/providers',
      editingProviderId ? 'PATCH' : 'POST',
      body,
    );
    if (saved) setProviderDialogOpen(false);
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
            ['providers', 'Provider'],
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
          {view === 'providers' && <Button size="sm" onClick={openCreateProvider}><Plus />新增 Provider</Button>}
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
        <EmptyState icon={ServerCog} title="暂无模型" description="新增逻辑模型后再配置 Provider 与默认路由" />
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

      {view === 'providers' && (configuration.providers.length === 0 ? (
        <EmptyState icon={ServerCog} title="暂无 Provider" description="为逻辑模型添加至少一个可执行渠道" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-hover">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">逻辑模型</th>
                <th className="p-3 text-left font-medium text-muted-foreground">渠道</th>
                <th className="p-3 text-left font-medium text-muted-foreground">SDK Model ID</th>
                <th className="p-3 text-right font-medium text-muted-foreground">优先级 / 成本</th>
                <th className="p-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {configuration.providers.map((provider) => (
                <tr key={provider.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-foreground">{provider.modelSlug}</td>
                  <td className="p-3"><p className="font-medium">{provider.providerName}</p><p className="text-xs text-muted-foreground">{provider.sdkClient}</p></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{provider.sdkModelId}</td>
                  <td className="p-3 text-right">
                    <p className="font-mono">{provider.priority}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider.costPerCall != null ? `${provider.costPerCall}/次` : '-'}
                      {provider.costPerSecond != null ? ` · ${provider.costPerSecond}/秒` : ''}
                    </p>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Badge variant={provider.isActive ? 'brand' : 'default'}>{provider.isActive ? '启用' : '停用'}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditProvider(provider)} aria-label={`编辑 ${provider.providerName}`}><Pencil /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        onClick={() => void mutate(`/api/admin/model-config/providers/${provider.id}/status`, 'PATCH', { isActive: !provider.isActive })}
                        aria-label={`${provider.isActive ? '停用' : '启用'} ${provider.providerName}`}
                      ><Power /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'routes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="route-capability">能力</Label>
              <select
                id="route-capability"
                value={selectedCapability}
                onChange={(event) => setSelectedCapability(event.target.value)}
                className="h-10 min-w-52 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              >
                {configuration.capabilities.map((capability) => <option key={capability.slug} value={capability.slug}>{capability.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route-model">添加模型</Label>
              <select
                id="route-model"
                value={routeCandidate}
                onChange={(event) => setRouteCandidate(event.target.value)}
                className="h-10 min-w-64 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              >
                <option value="">选择启用模型</option>
                {availableRouteModels.map((model) => <option key={model.slug} value={model.slug}>{model.name}</option>)}
              </select>
            </div>
            <Button variant="outline" onClick={addRouteModel} disabled={!routeCandidate}><Plus />添加</Button>
            <Button
              onClick={() => void mutate(`/api/admin/model-config/routes/${encodeURIComponent(selectedCapability)}`, 'PUT', { modelSlugs: routeModelSlugs })}
              disabled={saving || !selectedCapability || routeModelSlugs.length === 0}
            >
              {saving ? <Loader2 className="animate-spin" /> : <GitBranch />}
              保存路由
            </Button>
          </div>

          {routeModelSlugs.length === 0 ? (
            <EmptyState icon={GitBranch} title="暂无默认路由" description="至少添加一个支持该能力的启用模型" />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              {routeModelSlugs.map((slug, index) => {
                const model = configuration.models.find((candidate) => candidate.slug === slug);
                return (
                  <div key={slug} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{model?.name ?? slug}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{slug}</p>
                    </div>
                    {index === 0 && <Badge variant="primary">默认</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => moveRoute(index, -1)} disabled={index === 0} aria-label={`上移 ${slug}`}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" onClick={() => moveRoute(index, 1)} disabled={index === routeModelSlugs.length - 1} aria-label={`下移 ${slug}`}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setRouteModelSlugs((current) => current.filter((item) => item !== slug))} aria-label={`移除 ${slug}`}><Trash2 /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent showCloseButton className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingModelSlug ? '编辑模型' : '新增模型'}</DialogTitle>
            <DialogDescription>逻辑 slug 创建后不可修改；SDK Model ID 在 Provider 中配置。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="model-slug">Slug</Label><Input id="model-slug" value={modelForm.slug} disabled={Boolean(editingModelSlug)} onChange={(event) => setModelForm((current) => ({ ...current, slug: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="model-name">名称</Label><Input id="model-name" value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="model-modality">模态</Label><select id="model-modality" value={modelForm.modality} onChange={(event) => setModelForm((current) => ({ ...current, modality: event.target.value as ConfiguredModel['modality'] }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"><option value="llm">LLM</option><option value="image">图片</option><option value="video">视频</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="model-output">输出类型</Label><Input id="model-output" value={modelForm.outputType} onChange={(event) => setModelForm((current) => ({ ...current, outputType: event.target.value }))} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="model-capabilities">能力（逗号分隔）</Label><Input id="model-capabilities" value={modelForm.capabilities} onChange={(event) => setModelForm((current) => ({ ...current, capabilities: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="model-cost">用户积分成本</Label><Input id="model-cost" type="number" min="0" value={modelForm.costCredits} onChange={(event) => setModelForm((current) => ({ ...current, costCredits: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="model-sort">展示顺序</Label><Input id="model-sort" type="number" min="0" value={modelForm.sortOrder} onChange={(event) => setModelForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="model-description">说明</Label><Input id="model-description" value={modelForm.description} onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => void saveModel()} disabled={saving || !modelForm.name.trim() || !modelForm.capabilities.trim()}>{saving && <Loader2 className="animate-spin" />}保存模型</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader><DialogTitle>{editingProviderId ? '编辑 Provider' : '新增 Provider'}</DialogTitle><DialogDescription>仅配置渠道参数，不接受 API Key 或令牌。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="provider-model">逻辑模型</Label><select id="provider-model" disabled={Boolean(editingProviderId)} value={providerForm.modelSlug} onChange={(event) => setProviderForm((current) => ({ ...current, modelSlug: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">{configuration.models.map((model) => <option key={model.slug} value={model.slug}>{model.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="provider-name">Provider 名称</Label><Input id="provider-name" value={providerForm.providerName} onChange={(event) => setProviderForm((current) => ({ ...current, providerName: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="provider-client">SDK 客户端</Label><select id="provider-client" value={providerForm.sdkClient} onChange={(event) => setProviderForm((current) => ({ ...current, sdkClient: event.target.value as ConfiguredProvider['sdkClient'] }))} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"><option value="llm">llm</option><option value="image">image</option><option value="video">video</option><option value="replicate">replicate</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="provider-sdk-model">SDK Model ID</Label><Input id="provider-sdk-model" value={providerForm.sdkModelId} onChange={(event) => setProviderForm((current) => ({ ...current, sdkModelId: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="provider-priority">优先级</Label><Input id="provider-priority" type="number" min="1" value={providerForm.priority} onChange={(event) => setProviderForm((current) => ({ ...current, priority: event.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="provider-cost-call">单次采购成本</Label><Input id="provider-cost-call" type="number" min="0" step="0.0001" value={providerForm.costPerCall} onChange={(event) => setProviderForm((current) => ({ ...current, costPerCall: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="provider-cost-second">每秒采购成本</Label><Input id="provider-cost-second" type="number" min="0" step="0.0001" value={providerForm.costPerSecond} onChange={(event) => setProviderForm((current) => ({ ...current, costPerSecond: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => void saveProvider()} disabled={saving || !providerForm.modelSlug || !providerForm.providerName.trim() || !providerForm.sdkModelId.trim()}>{saving && <Loader2 className="animate-spin" />}保存 Provider</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
