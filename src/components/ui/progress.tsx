import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Progress — DESIGN.md 第 10.8 节
 *
 * | 尺寸 | 高度 | 用途            |
 * |------|------|----------------|
 * | default | 8px | 标准进度条     |
 * | slim    | 4px | 细进度条       |
 *
 * | variant | 填充色       | 用途           |
 * |---------|-------------|----------------|
 * | default | bg-primary  | 默认进度       |
 * | brand   | bg-brand    | 生成进度       |
 *
 * @example
 * <Progress value={60} variant="brand" />
 * <Progress value={30} size="slim" />
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 进度值 0-100 */
  value?: number;
  /** 尺寸 */
  size?: 'default' | 'slim';
  /** 颜色变体 */
  variant?: 'default' | 'brand';
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, size = 'default', variant = 'default', ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    const heightClass = size === 'slim' ? 'h-1' : 'h-2';
    const fillClass = variant === 'brand' ? 'bg-brand' : 'bg-primary';

    return (
      <div
        ref={ref}
        className={cn('w-full overflow-hidden rounded-full bg-muted', heightClass, className)}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', fillClass)}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
