import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'accent' | 'outline';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default:     'bg-primary-soft text-primary border-primary/20',
    accent:      'bg-accent-soft text-accent border-accent/20',
    secondary:   'bg-muted text-subtle border-line',
    success:     'bg-success-soft text-success border-success/20',
    warning:     'bg-warning-soft text-warning border-warning/20',
    destructive: 'bg-danger-soft text-danger border-danger/20',
    info:        'bg-info-soft text-info border-info/20',
    outline:     'border-line text-ink bg-surface',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
