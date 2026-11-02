'use client';

import React from 'react';
import { Icon } from '@/components/ui/icon';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-xs">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-on-primary mb-3">
          <Icon name="box" width={22} height={22} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-subtle leading-relaxed">
          {subtitle}
        </p>
      </div>

      {children}
    </div>
  );
}
