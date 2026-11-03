import * as React from 'react';
import { cn } from '../../lib/utils';

/** Select — đồng bộ style với Input component */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error = false, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl border bg-canvas text-ink text-sm appearance-none',
        'focus:outline-none focus:ring-2 focus:bg-surface transition-[border-color,box-shadow,background-color]',
        'pr-10', // space for arrow icon
        error
          ? 'border-danger focus:ring-danger/20 focus:border-danger'
          : 'border-line focus:ring-primary/20 focus:border-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2364748B' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        ...props.style,
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

