/**
 * FirstFrameSlot — 视频生成首帧图槽（图生视频 video-generation）
 *
 * 单图槽：空态虚线框（点击 → onSelect 上传 image/*），有态显示图片缩略图 + 名称 + 移除。
 * 点击有态缩略图 = 替换。契约：提交时 firstFrame: { fileId }（spec generate input）。
 */

import { ImageIcon, X, Loader2 } from 'lucide-react';

export interface UploadedFirstFrame {
  fileId: string;
  previewUrl: string;
  name: string;
}

export interface FirstFrameSlotProps {
  frame: UploadedFirstFrame | null;
  uploading: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function FirstFrameSlot({
  frame,
  uploading,
  disabled = false,
  onSelect,
  onRemove,
}: FirstFrameSlotProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={uploading || disabled}
        title={frame ? '替换首帧图' : '上传首帧图'}
        aria-label={frame ? '首帧图（已上传，点击替换）' : '首帧图（点击上传）'}
        className="group relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {frame ? (
          <>
            <img
              src={frame.previewUrl}
              alt={frame.name}
              className="h-full w-full object-cover"
              draggable={false}
            />
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 text-[10px] text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              替换
            </span>
          </>
        ) : uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </button>

      {frame && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-destructive"
          aria-label="移除首帧图"
          title="移除首帧图"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <span className="max-w-24 truncate text-[10px] leading-tight text-muted-foreground">
        {frame ? frame.name : '首帧图'}
      </span>
    </div>
  );
}
