import * as React from 'react';
import { cn } from '../../lib/utils';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled = false,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 bg-canvas border border-line rounded-xl p-1',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="w-10 h-10 rounded-lg hover:bg-muted text-ink flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed select-none font-bold"
        aria-label="Giảm số lượng"
      >
        -
      </button>

      <span className="w-8 text-center text-sm tabular font-bold text-ink select-none">
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || (max !== undefined && value >= max)}
        className="w-10 h-10 rounded-lg hover:bg-muted text-ink flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed select-none font-bold"
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
}
