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
    <div className={cn('w-full', className)}>
      {/* Connector + steps row */}
      <div className="relative flex items-start justify-between">
        {/* Connector line behind circles */}
        <div
          aria-hidden="true"
          className="absolute top-4 left-0 right-0 h-[2px] mx-[18px] bg-line z-0"
        />

        {steps.map((s, idx) => {
          const done = s.completed ?? s.active;
          const isCurrent = s.active && !s.completed;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center gap-2 flex-1">
              {/* Circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2',
                  done
                    ? 'bg-accent border-accent text-white shadow-md shadow-accent/30'
                    : isCurrent
                    ? 'bg-primary border-primary text-white shadow-md shadow-primary/30'
                    : 'bg-surface border-line text-subtle',
                )}
              >
                {done ? (
                  /* Check icon */
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
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
