import * as React from 'react';
import { cn } from '../../lib/utils';

/** Textarea — đồng bộ style với Input component */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-subtle',
        'focus:outline-none focus:ring-2 focus:bg-surface transition-[border-color,box-shadow,background-color]',
        'resize-y min-h-[100px]',
        error
          ? 'border-danger focus:ring-danger/20 focus:border-danger'
          : 'border-line focus:ring-primary/20 focus:border-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

