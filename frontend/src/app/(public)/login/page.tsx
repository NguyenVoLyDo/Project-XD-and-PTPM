import React from 'react';
import { AuthCard } from '@/features/auth/components/auth-card';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = {
  title: 'Đăng nhập — DropConnect',
  description: 'Đăng nhập vào hệ thống dropshipping DropConnect',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <AuthCard
          title="Chào mừng trở lại"
          subtitle="Đăng nhập để quản lý đơn hàng, gian hàng và kho của bạn"
        >
          <LoginForm />
        </AuthCard>
      </div>
    </main>
  );
}
