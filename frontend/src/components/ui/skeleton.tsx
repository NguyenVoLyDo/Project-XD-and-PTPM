import * as React from 'react';
import { cn } from '../../lib/utils';

/** Shimmer skeleton — dùng cho loading state placeholder */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-[#E2E8F0]',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        'before:animate-[shimmer_1.6s_infinite]',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
