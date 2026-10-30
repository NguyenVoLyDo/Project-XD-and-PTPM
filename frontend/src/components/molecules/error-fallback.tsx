import * as React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
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
    <Card className={cn('p-8 text-center max-w-md mx-auto space-y-4 border-rose-500/30 bg-rose-950/10', className)}>
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
        <svg aria-hidden="true" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="text-xs text-subtle max-w-xs mx-auto leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <div className="pt-2">
          <Button variant="secondary" size="sm" onClick={onRetry} className="hover:border-rose-500/40">
            <svg aria-hidden="true" className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Thử lại</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
