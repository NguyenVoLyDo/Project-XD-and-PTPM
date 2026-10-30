import * as React from 'react';
import { cn } from '../../lib/utils';

export function Label({ className, children, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn('block text-xs font-semibold text-ink tracking-wide mb-1.5', className)}
      {...props}
    >
      {children}
      {required && <span className="text-rose-700 ml-1">*</span>}
    </label>
  );
}
