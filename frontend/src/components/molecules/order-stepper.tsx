import * as React from 'react';
import { Icon } from '../ui/icon';
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
    <div className={cn('w-full', className)}>
      {/* Connector + steps row */}
      <div className="relative flex items-start justify-between">
        {/* Connector line behind circles */}
        <div
          aria-hidden="true"
          className="absolute top-3.5 left-0 right-0 h-[1px] mx-[18px] bg-line z-0"
        />

        {steps.map((s, idx) => {
          const done = s.completed ?? s.active;
          const isCurrent = s.active && !s.completed;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center gap-2 flex-1">
              {/* Circle */}
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 border',
                  done || isCurrent
                    ? 'bg-ink border-ink text-white'
                    : 'bg-surface border-line text-subtle',
                )}
              >
                {done ? (
                  <Icon name="check" className="w-3.5 h-3.5" />
                ) : (
                  idx + 1
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  'text-[11px] leading-tight text-center max-w-[72px]',
                  done || isCurrent ? 'text-ink font-semibold' : 'text-subtle font-medium',
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
