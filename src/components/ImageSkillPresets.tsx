import { useState, useRef, useEffect, useCallback } from 'react';
import { Wand2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ImageSkillPresets — 图片技能预设（对齐 boli SkillSelector / RunningHub「技能」）
 *
 * L1 文生图辅助：一键填充 prompt 模板（中文名 + 英文生成模板，质量优先）。
 * 预设不绑定模型/参数（模型动态、参数可选），仅填充提示词。
 */

export interface ImageSkillPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
}

export const IMAGE_SKILL_PRESETS: ImageSkillPreset[] = [
  { id: 'product', name: '商品摄影', description: '专业产品摄影，白底或场景', icon: '📸', prompt: 'Professional product photography, studio lighting, clean background, high detail' },
  { id: 'portrait', name: '人像写真', description: '专业人像摄影，柔和自然光', icon: '👤', prompt: 'Professional portrait photography, soft natural lighting, beautiful bokeh background, high detail' },
  { id: 'anime', name: '二次元', description: '动漫风格插画', icon: '🎨', prompt: 'Anime style illustration, vibrant colors, detailed character design, clean linework' },
  { id: 'poster', name: '海报设计', description: '创意海报，醒目排版', icon: '🖼️', prompt: 'Creative poster design, bold typography, eye-catching layout, professional composition' },
  { id: 'creative', name: '创意图', description: '创意视觉设计', icon: '✨', prompt: 'Creative visual design, abstract art, vibrant colors, unique composition' },
  { id: 'avatar', name: '头像生成', description: '个性化头像', icon: '🎭', prompt: 'Professional avatar portrait, clean background, well-lit, friendly expression' },
];

interface ImageSkillPresetsProps {
  disabled?: boolean;
  onApply: (preset: ImageSkillPreset) => void;
}

export function ImageSkillPresets({ disabled = false, onApply }: ImageSkillPresetsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="技能"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground transition-colors',
          open && 'border-brand/50',
          disabled && 'opacity-50',
        )}
      >
        <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span>技能</span>
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          {IMAGE_SKILL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => {
                setOpen(false);
                onApply(preset);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="text-base leading-none">{preset.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{preset.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{preset.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
