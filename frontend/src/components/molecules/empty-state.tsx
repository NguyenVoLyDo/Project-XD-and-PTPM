import * as React from 'react';
import Link from 'next/link';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('p-12 text-center max-w-lg mx-auto space-y-5', className)}>
      <div className="w-20 h-20 mx-auto rounded-3xl bg-primary-soft border border-primary/25 flex items-center justify-center text-primary shadow-xl">
        {icon || (
          <svg aria-hidden="true" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <p className="text-xs text-subtle max-w-sm mx-auto leading-relaxed">{description}</p>
      </div>

      {(actionText && (actionHref || onAction)) && (
        <div>
          {actionHref ? (
            <Link href={actionHref}>
              <Button variant="gradient" size="md">
                <span>{actionText}</span>
                <span className="text-xs">→</span>
              </Button>
            </Link>
          ) : (
            <Button variant="gradient" size="md" onClick={onAction}>
              <span>{actionText}</span>
              <span className="text-xs">→</span>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
