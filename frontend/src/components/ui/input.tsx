import * as React from 'react';
import { cn } from '../../lib/utils';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { error?: boolean; }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => (
    <input ref={ref} type={type} aria-invalid={error || undefined}
      className={cn('w-full min-h-11 px-3.5 py-2.5 rounded-xl bg-surface border text-ink text-base placeholder:text-subtle transition-colors disabled:opacity-50', error ? 'border-rose-600' : 'border-line hover:border-primary/40', className)} {...props} />
  ),
);
Input.displayName = 'Input';
