import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge — DESIGN.md 第 10.4 节
 *
 * | variant  | 样式                              | 用途               |
 * |----------|-----------------------------------|--------------------|
 * | default  | bg-muted text-muted-foreground    | 分类、状态         |
 * | primary  | bg-primary/10 text-primary        | 选中、激活         |
 * | brand    | bg-brand/10 text-brand            | 完成、在线         |
 * | warning  | bg-amber-500/10 text-amber-600    | 待处理、低信用     |
 * | destructive | bg-destructive/10 text-destructive | 失败、错误       |
 *
 * @example
 * <Badge variant="brand">已完成</Badge>
 * <Badge variant="warning">待处理</Badge>
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        primary: 'bg-primary/10 text-primary',
        brand: 'bg-brand/10 text-brand',
        warning: 'bg-amber-500/10 text-amber-600',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
