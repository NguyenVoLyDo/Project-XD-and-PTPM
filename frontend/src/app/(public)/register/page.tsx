import React from 'react';
import { AuthCard } from '@/features/auth/components/auth-card';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata = {
  title: 'Đăng ký tài khoản — DropConnect',
  description: 'Tạo tài khoản khách hàng, người bán hoặc nhà cung cấp trên DropConnect',
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 py-8">
        <AuthCard
          title="Tạo tài khoản mới"
          subtitle="Gia nhập hệ sinh thái Dropshipping kết nối Supplier, Seller và Khách hàng"
        >
          <RegisterForm />
        </AuthCard>
      </div>
    </main>
  );
}
