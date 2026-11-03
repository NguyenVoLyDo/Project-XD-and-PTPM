import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        'w-full min-h-11 px-3.5 py-2.5 rounded-xl bg-canvas border text-ink text-sm placeholder:text-subtle',
        'focus:outline-none focus:bg-surface transition-[border-color,box-shadow,background-color]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error
          ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:border-danger'
          : 'border-line hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/15',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

