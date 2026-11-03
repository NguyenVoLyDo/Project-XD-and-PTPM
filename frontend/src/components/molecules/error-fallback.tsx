import * as React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { cn } from '../../lib/utils';

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorFallback({
  title = 'Đã có lỗi xảy ra',
  message = 'Không thể kết nối đến máy chủ hoặc tải dữ liệu. Vui lòng thử lại.',
  onRetry,
  className,
}: ErrorFallbackProps) {
  return (
    <Card className={cn('p-8 text-center max-w-md mx-auto space-y-4 border border-line bg-surface', className)}>
      <div className="w-12 h-12 rounded-2xl bg-canvas border border-line text-subtle flex items-center justify-center mx-auto">
        <Icon name="alert" className="w-5 h-5" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-subtle max-w-xs mx-auto leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <Icon name="refresh" className="w-3.5 h-3.5 mr-1.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
