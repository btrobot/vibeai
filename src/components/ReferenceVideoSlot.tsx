/**
 * ReferenceVideoSlot — 参考视频槽（风格克隆 style-cloning 输入）
 *
 * 单视频槽：空态虚线框（点击 → onSelect 上传 video/*），有态显示视频缩略图 + 名称 + 移除。
 * 点击有态缩略图 = 替换。契约：提交时 referenceVideos: [{ fileId }]（spec generate input）。
 */

import { Video, X, Loader2, FileVideo } from 'lucide-react';

export interface UploadedRefVideo {
  fileId: string;
  previewUrl: string;
  name: string;
}

export interface ReferenceVideoSlotProps {
  video: UploadedRefVideo | null;
  uploading: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function ReferenceVideoSlot({
  video,
  uploading,
  disabled = false,
  onSelect,
  onRemove,
}: ReferenceVideoSlotProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={uploading || disabled}
        title={video ? '替换参考视频' : '上传参考视频'}
        aria-label={video ? '参考视频（已上传，点击替换）' : '参考视频（点击上传）'}
        className="group relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {video ? (
          <>
            <video
              src={video.previewUrl}
              className="h-full w-full object-cover"
              muted
              preload="metadata"
            />
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 text-[10px] text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              <FileVideo className="h-3 w-3" />
              替换
            </span>
          </>
        ) : uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
      </button>

      {video && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-destructive"
          aria-label="移除参考视频"
          title="移除参考视频"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <span className="max-w-24 truncate text-[10px] leading-tight text-muted-foreground">
        {video ? video.name : '参考视频'}
      </span>
    </div>
  );
}
