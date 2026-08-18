/**
 * ReferenceImageStack — 多参考图堆叠组件
 *
 * 交互模型移植自 /home/dev/boli 的 UploadStack（折叠堆叠 → hover 扇形展开），
 * 纯 TSX + Tailwind 语义类实现（DESIGN.md 合规：颜色一律语义类/允许例外，无 .css 新增）。
 *
 * 折叠态：卡片 ±5° 倾斜居中重叠，右侧露出 add 按钮
 * 展开态（hover，state 驱动）：卡片 ±8° 扇形水平展开，容器宽度过渡扩展保证
 *         命中区覆盖扇形范围（鼠标可停留点击），每卡可单独移除，底部提供清空全部
 */

import { useState, useCallback } from 'react';
import { Paperclip, Plus, X, Trash2, Loader2 } from 'lucide-react';

/** Layout constants — 适配 Workspace 48px rail（boli 原 60/80/36 过大） */
const CARD_W = 44;
const CARD_H = 56;
const SPREAD_STEP = 24;
const TILT_COLLAPSED = 5;
const TILT_FAN = 8;
const DEFAULT_MAX = 9;

export interface UploadedRefImage {
  fileId: string;
  previewUrl: string;
  name: string;
}

export interface ReferenceImageStackProps {
  files: UploadedRefImage[];
  uploading: boolean;
  disabled?: boolean;
  maxImages?: number;
  onAdd: () => void;
  onRemove: (fileId: string) => void;
  onClear: () => void;
}

export function ReferenceImageStack({
  files,
  uploading,
  disabled = false,
  maxImages = DEFAULT_MAX,
  onAdd,
  onRemove,
  onClear,
}: ReferenceImageStackProps) {
  const [expanded, setExpanded] = useState(false);
  const count = files.length;
  const atMax = count >= maxImages;

  const handleMouseEnter = useCallback(() => setExpanded(true), []);
  const handleMouseLeave = useCallback(() => setExpanded(false), []);

  // 空态：48×48 上传按钮（对齐现有 Workspace 视觉与 aria-label）
  if (count === 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading || disabled}
          className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          aria-label="上传参考图"
          title="上传参考图"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <span className="text-[10px] leading-none text-muted-foreground">参考图</span>
      </div>
    );
  }

  const spreadWidth = (count - 1) * SPREAD_STEP + CARD_W;

  return (
    <div
      className="relative z-20 overflow-visible transition-[width] duration-200 ease-out"
      style={{ width: expanded ? `${spreadWidth + 12}px` : '48px', height: CARD_H + 18 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {files.map((file, idx) => {
        const tiltDeg = idx % 2 === 0 ? -TILT_COLLAPSED : TILT_COLLAPSED;
        const fanDeg = idx % 2 === 0 ? -TILT_FAN : TILT_FAN;
        return (
          <div
            key={file.fileId}
            className="group absolute top-0"
            style={{
              left: expanded ? `${idx * SPREAD_STEP}px` : '50%',
              transform: expanded
                ? `rotate(${fanDeg}deg)`
                : `translate(-50%, 0) rotate(${tiltDeg}deg)`,
              zIndex: idx + 1,
            }}
          >
            <div className="h-14 w-11 overflow-hidden rounded-md border border-border bg-card shadow-sm">
              <img
                src={file.previewUrl}
                alt={file.name || `参考图 ${idx + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(file.fileId)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`移除参考图 ${idx + 1}`}
              title="移除该参考图"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* add 按钮：折叠态居中重叠（hover 即展开），展开态跟随扇形右侧 */}
      {!atMax && (
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading || disabled}
          className="absolute top-0 flex items-center justify-center rounded-md border border-dashed border-input text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-60"
          style={{
            left: expanded ? `${count * SPREAD_STEP + 8}px` : '50%',
            transform: expanded
              ? `rotate(${count % 2 === 0 ? -TILT_FAN : TILT_FAN}deg)`
              : `translate(-50%, 0) rotate(${count % 2 === 0 ? -TILT_COLLAPSED : TILT_COLLAPSED}deg)`,
            width: CARD_W,
            height: CARD_H,
            zIndex: count + 1,
          }}
          aria-label="添加参考图"
          title="添加参考图"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      )}

      {/* 展开态工具栏：清空全部 */}
      {expanded && count > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="absolute left-0 flex items-center gap-1 rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm transition-colors hover:text-destructive"
          style={{ top: CARD_H + 4 }}
          aria-label="清空参考图"
          title="清空全部参考图"
        >
          <Trash2 className="h-3 w-3" />
          清空
        </button>
      )}
    </div>
  );
}
