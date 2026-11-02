import React, { Suspense } from 'react';
import { AuthCard } from '@/features/auth/components/auth-card';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = {
  title: 'Đăng nhập — DropConnect',
  description: 'Đăng nhập vào hệ thống dropshipping DropConnect',
};

export default function LoginPage() {
  return (
    <div className="py-4 sm:py-10 flex justify-center items-center">
      <div className="w-full max-w-md">
        <AuthCard
          title="Chào mừng trở lại"
          subtitle="Đăng nhập để quản lý đơn hàng, gian hàng và nguồn hàng của bạn"
        >
          <Suspense fallback={<div className="h-44 animate-pulse bg-muted rounded-xl" />}>
            <LoginForm />
          </Suspense>
        </AuthCard>
      </div>
    </div>
  );
}
