import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * DataTable — wrapper có sticky header, hover row, responsive horizontal scroll.
 * Dùng cùng các thẻ HTML table tiêu chuẩn: <TableHead>, <TableBody>, <Th>, <Td>.
 */

export function DataTable({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-canvas border-b border-line', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-line', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function Tr({
  children,
  className,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors',
        onClick ? 'cursor-pointer hover:bg-canvas' : 'hover:bg-canvas/60',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Th({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-subtle whitespace-nowrap select-none',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 text-sm text-ink align-middle',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** TableEmpty — hiển thị khi bảng không có dữ liệu */
export function TableEmpty({ children = 'Không có dữ liệu', colSpan = 99 }: { children?: React.ReactNode; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-subtle text-sm">
        {children}
      </td>
    </tr>
  );
}

