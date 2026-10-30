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
  const sizeStyles = {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-bold',
  };

  const hasDiscount = originalAmount !== undefined && originalAmount > amount;

  return (
    <div className={cn('inline-flex items-baseline gap-2', className)}>
      <span className={cn('text-primary', sizeStyles[size])}>
        {amount.toLocaleString('vi-VN')} {currency}
      </span>
      {hasDiscount && (
        <span className="text-xs text-subtle line-through">
          {originalAmount.toLocaleString('vi-VN')} {currency}
        </span>
      )}
    </div>
  );
}
