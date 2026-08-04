/**
 * UI 组件统一出口
 *
 * 所有 DESIGN.md 标准组件从此文件导入：
 * import { Button, Badge, Progress, Skeleton, EmptyState, Card, Input, Label } from '@/components/ui';
 *
 * 组件清单（对应 DESIGN.md 章节）：
 * - Button   (10.1) — 7 variants: default/brand/destructive/outline/secondary/ghost/link
 * - Card     (10.2) — 无默认阴影, rounded-xl, hover 可加阴影
 * - Input    (10.3) — h-10, rounded-lg, 150ms transition
 * - Label    (16)   — text-sm font-medium
 * - Badge    (10.4) — 5 variants: default/primary/brand/warning/destructive
 * - Progress (10.8) — default/slim 尺寸, default/brand 颜色
 * - Skeleton (10.9) — animate-pulse bg-muted
 * - EmptyState (13.3) — 居中空状态，图标+标题+描述+CTA
 */

export { Button, buttonVariants, type ButtonProps } from './button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { Input } from './input';
export { Label } from './label';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Progress, type ProgressProps } from './progress';
export { Skeleton } from './skeleton';
export { EmptyState, type EmptyStateProps, type EmptyStateAction } from './empty-state';
