import * as React from 'react';
import { cn } from '../../lib/utils';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'icon'; isLoading?: boolean;
}
const variants = {
  default: 'bg-primary hover:bg-primary-hover text-on-primary',
  gradient: 'bg-primary hover:bg-primary-hover text-on-primary',
  secondary: 'bg-primary-soft hover:bg-muted text-primary',
  outline: 'border border-line bg-surface hover:bg-primary-soft text-ink',
  destructive: 'bg-rose-700 hover:bg-rose-800 text-on-primary',
  ghost: 'bg-transparent hover:bg-muted text-subtle hover:text-ink',
};
const sizes = { sm: 'min-h-10 px-3 text-sm', md: 'min-h-11 px-4 text-sm', lg: 'min-h-12 px-5 text-base', icon: 'h-11 w-11 p-0' };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', isLoading = false, disabled, children, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} disabled={disabled || isLoading} aria-busy={isLoading}
      className={cn('inline-flex items-center justify-center rounded-xl font-semibold gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed', variants[variant], sizes[size], className)} {...props}>
      {isLoading && <span aria-hidden="true" className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}{children}
    </button>
  ),
);
Button.displayName = 'Button';
