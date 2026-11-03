'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  containerClassName?: string;
}

/** SearchInput — ô tìm kiếm với icon kính lúp và nút clear */
export function SearchInput({ value, onClear, containerClassName, className, ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' ? value.length > 0 : false;

  return (
    <div className={cn('relative flex items-center', containerClassName)}>
      {/* Search icon */}
      <svg
        aria-hidden="true"
        className="absolute left-3 w-4 h-4 text-subtle pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>

      <input
        type="search"
        value={value}
        className={cn(
          'w-full pl-9 pr-9 py-2.5 rounded-xl border border-line bg-canvas text-ink placeholder:text-subtle text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface',
          'transition-[border-color,box-shadow,background-color]',
          className,
        )}
        {...props}
      />

      {/* Clear button */}
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Xóa tìm kiếm"
          className="absolute right-3 w-4 h-4 rounded-full bg-subtle/20 hover:bg-subtle/40 text-subtle flex items-center justify-center transition"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface FilterPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** FilterPill — pill lọc toggle */
export function FilterPill({ label, active = false, onClick, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-surface text-ink border-line hover:border-primary/40 hover:bg-primary-soft hover:text-primary',
        className,
      )}
    >
      {label}
    </button>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

/** FilterBar — wrapper chứa SearchInput + FilterPills */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {children}
    </div>
  );
}

