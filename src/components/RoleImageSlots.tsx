/**
 * RoleImageSlots — 参考图角色槽位组件（对齐 RunningHub 心智模型）
 *
 * 当用户手动选择带 refImageRoles 的图片能力时（如模特换装：模特图+衣服图），
 * 渲染独立带标签的槽位，每槽一张图：
 *   - 空槽：虚线框 + "+"（点击 → onAdd(role) 上传）
 *   - 有图：缩略图（点击 → 重新上传/替换），右上角 X 移除
 *
 * 纯 TSX + Tailwind 语义类（DESIGN.md 合规），无新增 .css。
 * 槽位语义定义见 WorkspacePage REF_IMAGE_ROLES 与 specs/gateway.spec.yaml refImageRoles。
 */

import { Plus, X, Loader2 } from 'lucide-react';
import type { UploadedRefImage } from '@/components/ReferenceImageStack';

export interface RoleImageSlot {
  role: string;
  label: string;
  max: number;
}

export interface RoleImageSlotsProps {
  files: UploadedRefImage[];
  roles: RoleImageSlot[];
  uploading: boolean;
  disabled?: boolean;
  onAdd: (role: string) => void;
  onRemove: (fileId: string) => void;
}

export function RoleImageSlots({
  files,
  roles,
  uploading,
  disabled = false,
  onAdd,
  onRemove,
}: RoleImageSlotsProps) {
  return (
    <div className="flex shrink-0 flex-col justify-center gap-2">
      {roles.map((slot) => {
        const slotFiles = files.filter((f) => f.role === slot.role);
        const current = slotFiles[0];
        return (
          <div key={slot.role} className="flex items-center gap-2">
            {/* 槽位卡片：空态 = 上传按钮；有图 = 缩略图（点击替换） */}
            <button
              type="button"
              onClick={() => onAdd(slot.role)}
              disabled={uploading || disabled}
              title={current ? `替换${slot.label}` : `上传${slot.label}`}
              aria-label={`${slot.label}${current ? '（已上传，点击替换）' : '（点击上传）'}`}
              className="group relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {current ? (
                <>
                  <img
                    src={current.previewUrl}
                    alt={current.name || slot.label}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                    替换
                  </span>
                </>
              ) : uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>

            {/* 移除按钮（有图时） */}
            {current && (
              <button
                type="button"
                onClick={() => onRemove(current.fileId)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-destructive"
                aria-label={`移除${slot.label}`}
                title={`移除${slot.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}

            <span className="max-w-16 text-[10px] leading-tight text-muted-foreground">
              {slot.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
