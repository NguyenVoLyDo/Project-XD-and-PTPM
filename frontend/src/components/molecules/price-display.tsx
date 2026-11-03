import * as React from 'react';
import { cn } from '../../lib/utils';

interface PriceDisplayProps {
  amount: number;
  originalAmount?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  currency?: string;
}

export function PriceDisplay({
  amount,
  originalAmount,
  size = 'md',
  className,
  currency = 'đ',
}: PriceDisplayProps) {
  const sizeStyles: Record<string, string> = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-bold',
  };

  const hasDiscount = originalAmount !== undefined && originalAmount > amount;

  return (
    <div className={cn('inline-flex items-baseline gap-2', className)}>
      <span
        className={cn(
          'text-primary tabular-nums',
          sizeStyles[size],
        )}
      >
        {amount.toLocaleString('vi-VN')}&thinsp;{currency}
      </span>
      {hasDiscount && (
        <span className="text-xs text-subtle line-through tabular-nums">
          {originalAmount!.toLocaleString('vi-VN')}&thinsp;{currency}
        </span>
      )}
    </div>
  );
}
