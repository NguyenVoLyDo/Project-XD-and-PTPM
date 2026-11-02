import React from 'react';
import { AuthCard } from '@/features/auth/components/auth-card';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata = {
  title: 'Đăng ký tài khoản — DropConnect',
  description: 'Tạo tài khoản khách hàng, người bán hoặc nhà cung cấp trên DropConnect',
};

export default function RegisterPage() {
  return (
    <div className="py-4 sm:py-8 flex justify-center items-center">
      <div className="w-full max-w-md">
        <AuthCard
          title="Tạo tài khoản mới"
          subtitle="Gia nhập hệ sinh thái Dropshipping kết nối Supplier, Seller và Khách hàng"
        >
          <RegisterForm />
        </AuthCard>
      </div>
    </div>
  );
}
