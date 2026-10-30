import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-primary-soft text-primary border-primary/25',
    secondary: 'bg-muted text-ink border-line',
    success: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    destructive: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
    outline: 'border-line text-ink bg-transparent',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
