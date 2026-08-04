import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — DESIGN.md 第 13.3 节
 *
 * 空状态组件：
 * - 居中布局
 * - 大图标（48px, text-muted-foreground）
 * - 标题（H3, text-base font-medium）
 * - 描述（Body, text-sm text-muted-foreground）
 * - 可选 CTA 按钮
 *
 * @example
 * <EmptyState
 *   icon={FolderKanban}
 *   title="暂无项目"
 *   description="创建你的第一个项目开始创作"
 *   action={{ label: '新建项目', onClick: () => setShowModal(true) }}
 * />
 */
interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide 图标组件 */
  icon?: LucideIcon;
  /** 标题 */
  title: string;
  /** 描述文字 */
  description?: string;
  /** CTA 操作 */
  action?: EmptyStateAction;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}
      {...props}
    >
      {Icon && <Icon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
export type { EmptyStateProps, EmptyStateAction };
