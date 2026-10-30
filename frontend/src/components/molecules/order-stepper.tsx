import * as React from 'react';
import { cn } from '../../lib/utils';

export interface StepItem {
  label: string;
  active: boolean;
  completed?: boolean;
}

interface OrderStepperProps {
  steps: StepItem[];
  className?: string;
}

export function OrderStepper({ steps, className }: OrderStepperProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative">
        {steps.map((s, idx) => (
          <div key={idx} className="flex flex-col items-center text-center space-y-2">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition shadow-lg',
                s.active
                  ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-ink ring-2 ring-indigo-400/50'
                  : 'bg-canvas border border-line text-subtle',
              )}
            >
              {s.active ? '✓' : idx + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium leading-tight',
                s.active ? 'text-ink' : 'text-subtle',
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
