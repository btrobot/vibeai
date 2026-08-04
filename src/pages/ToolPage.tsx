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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { LucideIcon } from 'lucide-react';

const toolConfig: Record<string, { name: string; description: string; icon: LucideIcon; color: string; capability: string }> = {
  'background-removal': {
    name: '白底图生成',
    description: '一键去除商品背景，生成纯白底图，支持批量处理',
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

export default function ToolPage({ toolSlug: _toolSlug }: { toolSlug?: string } = {}) {
  const navigate = useNavigate();
  const params = useParams<{ toolType?: string }>();
  const toolSlug = _toolSlug ?? params.toolType ?? '';
  const config = toolConfig[toolSlug];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
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
  const getAuthHeaders = (): Record<string, string> => {
    const stored = localStorage.getItem('auth_tokens');
    if (!stored) return {};
    const { accessToken } = JSON.parse(stored);
    return { Authorization: `Bearer ${accessToken}` };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  const ensureProject = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/projects?pageSize=1', { headers: { ...getAuthHeaders() } });
      const result = await res.json();
      const data = result.data ?? result;
      if (data.items?.length > 0) return data.items[0].id;

      // No projects — create a default one
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: '工具创作', description: '快速工具生成' }),
      });
      if (createRes.ok) {
        const createResult = await createRes.json();
        const createData = createResult.data ?? createResult;
        return createData.id;
      }
    } catch {
      // Silently fail
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!file && !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const projectId = await ensureProject();
      if (!projectId) {
        setError('无法获取项目，请先创建项目');
        setLoading(false);
        return;
      }

      let uploadedFileId = '';
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'temp');

        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: { ...getAuthHeaders() },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          const upload = uploadData.data ?? uploadData;
          uploadedFileId = upload.id || '';
        }
      }

      const generateRes = await fetch('/api/gateway/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          projectId,
          capabilitySlug: config.capability,
          input: {
            prompt: prompt.trim() || `使用 ${config.name} 工具处理`,
            ...(uploadedFileId ? { referenceImage: { fileId: uploadedFileId } } : {}),
          },
        }),
      });

      const generateData = await generateRes.json();
      if (generateRes.ok) {
        const genResult = generateData.data ?? generateData;
        const taskId = genResult.taskId || genResult.id;
        if (taskId) {
          const poll = async () => {
            const taskRes = await fetch(`/api/tasks/${taskId}`, {
              headers: { ...getAuthHeaders() },
            });
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

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">提示词</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`输入描述，例如：${toolSlug === 'background-removal' ? '去除背景，保留商品主体' : toolSlug === 'scene-composition' ? '将商品放在自然光下的木桌上' : toolSlug === 'model-dressing' ? '模特穿这件衣服在户外街拍' : '生成包含商品详情、规格、卖点的详情页'}`}
              rows={4}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none transition-all duration-150"
            />
          </div>

          <Button
            variant="brand"
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={(!file && !prompt.trim()) || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始生成
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
