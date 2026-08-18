import { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ImageParamAggregate — 图片参数聚合按钮（对齐 boli ImageParamAggregate / RunningHub「16:9 · 2k · 中」）
 *
 * L1 生成层参数（图片 Tab）：比例 / 规格 / 质量。可用项由模型 inputSchema（SOT）驱动，
 * 无 inputSchema 枚举且无 constraints 约束的模型（如 sdxl/flux）不渲染（无可调参数）。
 */

interface ParamModel {
  modality?: string;
  constraints?: Record<string, unknown>;
  inputSchema?: { properties?: Record<string, { enum?: string[]; default?: unknown }> };
  defaultParams?: Record<string, unknown>;
}

interface ImageParamAggregateProps {
  model: ParamModel | undefined;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}

const QUALITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  auto: '自动',
};

function qualityLabel(q: string | undefined): string {
  return q ? (QUALITY_LABELS[q] ?? q) : '';
}

interface ParamOptions {
  ratios: string[];
  sizes: string[];
  qualities: string[];
}

function getParamOptions(model: ParamModel | undefined): ParamOptions | null {
  if (!model || model.modality !== 'image') return null;
  const schema = model.inputSchema?.properties ?? {};
  const constraints = model.constraints ?? {};
  const ratios = (((schema.aspect_ratio?.enum as string[] | undefined) ?? (constraints.ratios as string[] | undefined) ?? []) || []).filter(Boolean);
  const sizes = (((constraints.sizes as string[] | undefined) ?? (schema.size?.enum as string[] | undefined) ?? []) || []).filter(Boolean);
  const qualities = ((schema.quality?.enum as string[] | undefined) ?? []).filter(Boolean);
  if (ratios.length === 0 && sizes.length === 0 && qualities.length === 0) return null;
  return { ratios, sizes, qualities };
}

export function ImageParamAggregate({ model, value, onChange }: ImageParamAggregateProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options = getParamOptions(model);
  const defaults = model?.defaultParams ?? {};

  const curRatio = value.ratio || (defaults.aspect_ratio as string | undefined) || options?.ratios[0] || '';
  const curSize = value.size || (defaults.size as string | undefined) || options?.sizes[0] || '';
  const curQuality = value.quality || (defaults.quality as string | undefined) || options?.qualities[0] || '';

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  if (!options) return null;

  const segments: string[] = [];
  if (options.ratios.length > 0 && curRatio) segments.push(curRatio);
  if (options.sizes.length > 0 && curSize) segments.push(curSize);
  if (options.qualities.length > 0 && curQuality) segments.push(qualityLabel(curQuality));
  const summary = segments.length > 0 ? segments.join(' · ') : '参数';

  const set = (patch: Record<string, string>) => onChange({ ...value, ...patch });

  const OptionBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
        active
          ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      {label}
      {active && <Check className="h-3 w-3" />}
    </button>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="图片参数"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground transition-colors',
          open && 'border-brand/50',
        )}
      >
        <Maximize className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[180px] truncate">{summary}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          {options.ratios.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">比例</p>
              <div className="grid grid-cols-3 gap-1.5">
                {options.ratios.map((r) => (
                  <OptionBtn key={r} label={r} active={curRatio === r} onClick={() => set({ ratio: r })} />
                ))}
              </div>
            </div>
          )}
          {options.sizes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">规格</p>
              <div className="grid grid-cols-3 gap-1.5">
                {options.sizes.map((s) => (
                  <OptionBtn key={s} label={s} active={curSize === s} onClick={() => set({ size: s })} />
                ))}
              </div>
            </div>
          )}
          {options.qualities.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">质量</p>
              <div className="grid grid-cols-3 gap-1.5">
                {options.qualities.map((q) => (
                  <OptionBtn key={q} label={qualityLabel(q)} active={curQuality === q} onClick={() => set({ quality: q })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
