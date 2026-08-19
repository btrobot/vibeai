import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Download,
  ShieldCheck,
  Palette,
  Shirt,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/apiClient';
import { EmptyState } from '@/components/ui/empty-state';
import type { LucideIcon } from 'lucide-react';

// 2026-08-19 产品决策：恢复 白底图/场景合成/模特换装 独立工具页入口
// （工作区能力选择器仍收敛为 L1 文生图/图片编辑，L2 后处理经 /tools/* 工具页开放，spec enabled: true）
// 导出 toolConfig 供 image-capability-consistency 防漂移测试引用（L2 能力 ↔ 工具页全覆盖）
export const toolConfig: Record<string, { name: string; description: string; icon: LucideIcon; color: string; capability: string }> = {
  'background-removal': {
    name: '白底图生成',
    description: '上传产品图片，一键生成纯白/自定义背景产品图',
    icon: ShieldCheck,
    color: 'text-muted-foreground',
    capability: 'background-removal',
  },
  'scene-composition': {
    name: '场景合成',
    description: '将商品智能融入各类场景，生成自然逼真的场景图',
    icon: Palette,
    color: 'text-brand',
    capability: 'scene-composition',
  },
  'model-dressing': {
    name: '模特换装',
    description: 'AI 虚拟模特换装，快速生成不同穿搭效果图',
    icon: Shirt,
    color: 'text-primary',
    capability: 'model-dressing',
  },
  'detail-page': {
    name: '详情页生成',
    description: 'AI 自动生成商品详情页，包含文案、排版、图片',
    icon: FileText,
    color: 'text-foreground',
    capability: 'detail-page-generation',
  },
};

// boli 对齐：白底图背景色选择（对齐 boli apps/web whitebg BG_COLORS：纯白/浅灰/银灰/纯黑/透明）
export const BG_COLORS: Array<{ value: string; label: string }> = [
  { value: '#ffffff', label: '纯白' },
  { value: '#f5f5f5', label: '浅灰' },
  { value: '#e8e8e8', label: '银灰' },
  { value: '#000000', label: '纯黑' },
  { value: 'transparent', label: '透明' },
];

// boli 对齐：场景合成预设（对齐 boli apps/web scene-compose SCENE_PRESETS，8 场景）
export const SCENE_PRESETS: Array<{ value: string; label: string; desc: string }> = [
  { value: 'living-room', label: '客厅', desc: '现代简约客厅' },
  { value: 'kitchen', label: '厨房', desc: '整洁明亮厨房' },
  { value: 'bedroom', label: '卧室', desc: '温馨卧室场景' },
  { value: 'outdoor', label: '户外', desc: '自然户外环境' },
  { value: 'office', label: '办公', desc: '商务办公场景' },
  { value: 'cafe', label: '咖啡厅', desc: '休闲咖啡厅' },
  { value: 'studio-white', label: '白色影棚', desc: '纯白背景影棚' },
  { value: 'studio-dark', label: '深色影棚', desc: '深色背景影棚' },
];

// boli 对齐：光影风格（对齐 boli LIGHTING_STYLES，5 风格）
export const LIGHTING_STYLES: Array<{ value: string; label: string; desc: string }> = [
  { value: 'studio', label: '摄影棚', desc: '专业摄影棚灯光' },
  { value: 'natural', label: '自然光', desc: '柔和自然光线' },
  { value: 'dramatic', label: '戏剧光', desc: '强烈明暗对比' },
  { value: 'warm', label: '暖光', desc: '温暖舒适氛围' },
  { value: 'cool', label: '冷光', desc: '冷静科技感' },
];

// boli 对齐：风格强度 slider（0.1–1，步进 0.05，默认 0.7）
export const SCENE_DEFAULT_STRENGTH = 0.7;
export const SCENE_STRENGTH_MIN = 0.1;
export const SCENE_STRENGTH_MAX = 1;
export const SCENE_STRENGTH_STEP = 0.05;

// boli 对齐：模特换装固定基础 prompt（对齐 boli ClothingChangeRecipe prompt='模特换装'；
// 扩写以适配 OpenAI 多图编辑的角色顺序语义：第一张模特、第二张服装）
export const MODEL_DRESSING_BASE_PROMPT =
  '模特换装：第一张图为模特，第二张图为服装，将服装穿到模特身上，保持模特面部和姿态不变，生成自然逼真的试穿效果图';

// boli 对齐：模特图拍摄建议（对齐 boli clothing-change 页面 Tips 文案）
export const MODEL_DRESSING_TIPS: string[] = [
  '正面或微侧面站立姿势',
  '双手自然下垂或叉腰',
  '避免遮挡身体主要部位',
  '背景简洁、光线充足',
];

export default function ToolPage({ toolSlug: _toolSlug }: { toolSlug?: string } = {}) {
  const navigate = useNavigate();
  const params = useParams<{ toolType?: string }>();
  const toolSlug = _toolSlug ?? params.toolType ?? '';
  const config = toolConfig[toolSlug];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff'); // 白底图背景色（boli 对齐，默认纯白）
  const [sceneTemplate, setSceneTemplate] = useState('living-room'); // 场景合成：场景模板（boli 对齐，默认客厅）
  const [lightingStyle, setLightingStyle] = useState('studio'); // 场景合成：光影风格（boli 对齐，默认摄影棚）
  const [strength, setStrength] = useState(SCENE_DEFAULT_STRENGTH); // 场景合成：风格强度（boli 对齐，默认 0.7）
  const [garmentFile, setGarmentFile] = useState<File | null>(null); // 模特换装：服装图（第二张）
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const isModelDressing = toolSlug === 'model-dressing';
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="p-6">
        <EmptyState icon={ImageIcon} title="工具不存在" description="请从导航菜单选择有效的工具" />
      </div>
    );
  }

  const Icon = config.icon;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  // 模特换装：服装图（第二张）上传（boli 对齐双槽位）
  const handleGarmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setGarmentFile(f);
      setGarmentPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  // 导航电商工具直通入口：统一归属每用户的「工具箱」项目（后端幂等创建，无需前端找/建项目）
  const ensureProject = async (): Promise<string | null> => {
    try {
      const res = await apiFetch('/api/projects/default');
      const result = await res.json();
      const data = result.data ?? result;
      return data?.id ?? null;
    } catch {
      return null;
    }
  };

  // boli 对齐：各工具 prompt 构造
  // - 场景合成：对齐 boli SceneComposeRecipe.buildScenePrompt（场景描述 + lighting + scene 模板 + 电商后缀）
  // - 模特换装：固定基础 prompt（对齐 boli prompt='模特换装'）+ 可选补充要求
  const buildPrompt = (): string => {
    const trimmed = prompt.trim();
    if (toolSlug === 'scene-composition') {
      const parts: string[] = [];
      parts.push(trimmed || `Place the product in a ${sceneTemplate} scene`);
      parts.push(`${lightingStyle} lighting`);
      parts.push(`scene: ${sceneTemplate}`);
      parts.push('professional product photography, high quality, detailed');
      return parts.join(', ');
    }
    if (isModelDressing) {
      return trimmed
        ? `${MODEL_DRESSING_BASE_PROMPT}。补充要求：${trimmed}`
        : MODEL_DRESSING_BASE_PROMPT;
    }
    return (
      trimmed ||
      (toolSlug === 'background-removal'
        ? `去除背景，保留商品主体，生成${BG_COLORS.find((c) => c.value === bgColor)?.label ?? '纯白'}底图`
        : `使用 ${config.name} 工具处理`)
    );
  };

  const handleSubmit = async () => {
    // 模特换装（boli 对齐）：模特图 + 服装图双槽必填
    if (isModelDressing ? !file || !garmentFile : !file && !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const projectId = await ensureProject();
      if (!projectId) {
        setError('无法获取项目，请刷新页面后重试');
        setLoading(false);
        return;
      }

      let uploadedFileId = '';
      let garmentFileId = '';
      for (const [target, slotFile] of [
        ['file', file],
        ['garment', isModelDressing ? garmentFile : null],
      ] as Array<[string, File | null]>) {
        if (!slotFile) continue;
        const formData = new FormData();
        formData.append('file', slotFile);
        formData.append('category', 'temp');

        const uploadRes = await apiFetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          const upload = uploadData.data ?? uploadData;
          const fid = upload.id || '';
          if (target === 'file') uploadedFileId = fid;
          else garmentFileId = fid;
        }
      }

      const generateRes = await apiFetch('/api/gateway/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          capabilitySlug: config.capability,
          input: {
            prompt: buildPrompt(),
            // 适配器消费契约：参考图必须是复数 referenceImages 数组（单数 referenceImage 会被忽略 → refs=0 走文生图）
            // 模特换装（boli 对齐）：双参考图按角色顺序排列（第一张模特、第二张服装）
            referenceImages: uploadedFileId || garmentFileId
              ? [
                  ...(uploadedFileId ? [{ fileId: uploadedFileId }] : []),
                  ...(garmentFileId ? [{ fileId: garmentFileId }] : []),
                ]
              : [],
            // 白底图对齐（boli）：背景色透传（hex/transparent）→ OpenAI background opaque/transparent；rmbg-2-0 → background_color
            ...(toolSlug === 'background-removal' ? { backgroundColor: bgColor } : {}),
            // 场景合成对齐（boli）：场景模板/光影/强度透传（进入 creates.input 快照；OpenAI 适配器按需消费）
            ...(toolSlug === 'scene-composition' ? { sceneTemplate, lightingStyle, strength } : {}),
          },
        }),
      });

      const generateData = await generateRes.json();
      if (generateRes.ok) {
        const genResult = generateData.data ?? generateData;
        const taskId = genResult.taskId || genResult.id;
        if (taskId) {
          const poll = async () => {
            const taskRes = await apiFetch(`/api/tasks/${taskId}`);
            const taskData = await taskRes.json();
            const task = taskData.data ?? taskData;
            if (task.status === 'completed') {
              const output = task.output;
              if (output?.images?.length) {
                const img = output.images[0];
                setResult(typeof img === 'string' ? img : img.url);
              } else if (output?.content) {
                setResult(output.content);
              } else if (output?.text) {
                setResult(output.text);
              } else {
                setResult(JSON.stringify(output, null, 2));
              }
              setLoading(false);
            } else if (task.status === 'failed') {
              setError(task.errorMessage || '生成失败');
              setLoading(false);
            } else {
              setTimeout(poll, 1000);
            }
          };
          setTimeout(poll, 1000);
        } else {
          setLoading(false);
        }
      } else {
        setError(generateData.error || generateData.message || '提交失败');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
      setLoading(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${toolSlug}-result.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{config.name}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          {isModelDressing ? (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">模特图（第一张）</h2>

                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="模特图预览"
                      className="w-full h-48 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-primary-foreground"
                    >
                      更换
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/30">
                    <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">点击上传模特图</p>
                    <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP，最大 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">衣服图（第二张）</h2>

                {garmentPreview ? (
                  <div className="relative">
                    <img
                      src={garmentPreview}
                      alt="衣服图预览"
                      className="w-full h-48 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => {
                        setGarmentFile(null);
                        setGarmentPreview(null);
                      }}
                      className="absolute top-2 right-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-primary-foreground"
                    >
                      更换
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/30">
                    <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">点击上传衣服图</p>
                    <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP，最大 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGarmentChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-border bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">模特图拍摄建议</h2>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {MODEL_DRESSING_TIPS.map((tip) => (
                        <li key={tip}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">上传图片</h2>

              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt="预览"
                    className="w-full h-48 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-primary-foreground"
                  >
                    更换
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/30">
                  <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">点击上传图片</p>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP，最大 10MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {toolSlug === 'background-removal' && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">选择背景颜色</h2>
              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setBgColor(color.value)}
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-all ${
                      bgColor === color.value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={{
                        backgroundColor: color.value === 'transparent' ? '#fff' : color.value,
                        ...(color.value === 'transparent'
                          ? {
                              backgroundImage:
                                'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 4px 4px',
                            }
                          : {}),
                      }}
                    />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toolSlug === 'scene-composition' && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">选择场景</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SCENE_PRESETS.map((scene) => (
                  <button
                    key={scene.value}
                    type="button"
                    onClick={() => setSceneTemplate(scene.value)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2 text-left text-sm transition-all ${
                      sceneTemplate === scene.value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    <span className="font-medium">{scene.label}</span>
                    <span className="text-xs opacity-80">{scene.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {toolSlug === 'scene-composition' && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">光影风格</h2>
              <div className="flex flex-wrap gap-2">
                {LIGHTING_STYLES.map((light) => (
                  <button
                    key={light.value}
                    type="button"
                    onClick={() => setLightingStyle(light.value)}
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-all ${
                      lightingStyle === light.value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    <span className="font-medium">{light.label}</span>
                    <span className="text-xs opacity-80">{light.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {toolSlug === 'scene-composition' && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">风格强度</h2>
                <span className="text-sm text-muted-foreground">{Math.round(strength * 100)}%</span>
              </div>
              <input
                type="range"
                min={SCENE_STRENGTH_MIN}
                max={SCENE_STRENGTH_MAX}
                step={SCENE_STRENGTH_STEP}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                aria-label="风格强度"
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">控制场景与光影的融合程度，值越高风格越明显（0.1 – 1.0）</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              {isModelDressing ? '补充要求（可选）' : '提示词'}
            </h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`${isModelDressing ? '可选：描述期望的穿搭效果、姿势或场景' : '输入描述，例如：'}${toolSlug === 'background-removal' ? '去除背景，保留商品主体' : toolSlug === 'scene-composition' ? '将商品放在自然光下的木桌上' : toolSlug === 'model-dressing' ? '（例如：叉腰站姿、户外街拍）' : '生成包含商品详情、规格、卖点的详情页'}`}
              rows={4}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none transition-all duration-150"
            />
          </div>

          <Button
            variant="brand"
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={(isModelDressing ? !file || !garmentFile : !file && !prompt.trim()) || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {isModelDressing ? '开始换装' : '开始生成'}
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">生成结果</h2>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">正在生成，请稍候...</p>
            </div>
          )}

          {!result && !loading && !error && (
            <EmptyState
              icon={ImageIcon}
              title="等待输入"
              description="上传图片并输入提示词后，点击「开始生成」"
              className="py-16"
            />
          )}

          {result && !loading && (
            <div className="space-y-3">
              {result.startsWith('http') || result.startsWith('/api/') || result.startsWith('/storage/') ? (
                <div className="relative">
                  <img
                    src={result}
                    alt="生成结果"
                    className="w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => handleDownload(result)}
                    className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-primary-foreground hover:bg-black/60"
                  >
                    <Download className="h-3 w-3" />
                    下载
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-background p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
                </div>
              )}
              {(result.startsWith('http') || result.startsWith('/api/') || result.startsWith('/storage/')) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownload(result)}
                >
                  <Download className="h-4 w-4" />
                  下载结果
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
