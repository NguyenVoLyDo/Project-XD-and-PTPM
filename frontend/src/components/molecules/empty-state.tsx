import * as React from 'react';
import Link from 'next/link';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Icon, IconName } from '../ui/icon';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode | IconName;
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
    <Card className={cn('p-10 text-center max-w-lg mx-auto space-y-4 border border-line', className)}>
      <div className="w-12 h-12 mx-auto rounded-2xl bg-canvas border border-line flex items-center justify-center text-subtle">
        {typeof icon === 'string' ? (
          <Icon name={icon as IconName} className="w-5 h-5" />
        ) : (
          icon || <Icon name="box" className="w-5 h-5" />
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-subtle max-w-sm mx-auto leading-relaxed">{description}</p>
      </div>

      {actionText && (actionHref || onAction) && (
        <div className="pt-1">
          {actionHref ? (
            <Link href={actionHref}>
              <Button variant="default" size="sm">
                <span>{actionText}</span>
                <Icon name="arrow" className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          ) : (
            <Button variant="default" size="sm" onClick={onAction}>
              <span>{actionText}</span>
              <Icon name="arrow" className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
