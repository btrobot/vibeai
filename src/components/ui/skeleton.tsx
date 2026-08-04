import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton — DESIGN.md 第 10.9 节
 *
 * 骨架屏占位组件，用于加载状态。
 * 背景：bg-muted，动画：animate-pulse
 *
 * @example
 * <Skeleton className="h-4 w-full" />        // 文本行
 * <Skeleton className="h-32 w-full rounded-xl" /> // 卡片
 * <div className="flex gap-4">
 *   <Skeleton className="h-12 w-12 rounded-full" /> // 头像
 *   <div className="space-y-2">
 *     <Skeleton className="h-4 w-48" />
 *     <Skeleton className="h-3 w-32" />
 *   </div>
 * </div>
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
  ),
);
Skeleton.displayName = 'Skeleton';

export { Skeleton };
