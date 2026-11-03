import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'gradient' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const variants = {
  default:     'bg-primary hover:bg-primary-hover text-on-primary shadow-xs active:scale-[0.99]',
  gradient:    'bg-primary hover:bg-primary-hover text-on-primary shadow-xs active:scale-[0.99]',
  accent:      'bg-accent hover:bg-accent-hover text-white shadow-xs active:scale-[0.99]',
  secondary:   'bg-primary-soft hover:bg-primary-soft/70 text-primary font-semibold',
  outline:     'border border-line bg-surface hover:bg-primary-soft hover:border-primary/30 text-ink',
  destructive: 'bg-danger hover:bg-danger-hover text-white shadow-xs active:scale-[0.99]',
  ghost:       'bg-transparent hover:bg-muted text-subtle hover:text-ink',
};

const sizes = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  icon: 'h-10 w-10 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', isLoading = false, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {isLoading && <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
