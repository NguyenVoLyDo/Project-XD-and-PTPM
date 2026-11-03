'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/features/auth/components/auth-card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <div className="py-4 sm:py-10 flex justify-center items-center">
      <div className="w-full max-w-md">
        <AuthCard
          title="Khôi phục mật khẩu"
          subtitle="Nhập email tài khoản để nhận hỗ trợ khôi phục quyền truy cập"
        >
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-primary-soft border border-primary/20 text-ink text-xs leading-relaxed">
                Hệ thống Demo hiện chưa hỗ trợ gửi email tự động. Vui lòng liên hệ Quản trị viên hệ thống để được hỗ trợ cấp lại quyền truy cập tài khoản.
              </div>
              <Link
                href="/login"
                className="inline-block py-2.5 px-5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold shadow-xs transition"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email-input"
                  className="block text-xs font-semibold text-ink mb-1.5"
                >
                  Địa chỉ Email
                </label>
                <input
                  id="forgot-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-ink placeholder:text-subtle/70 text-sm focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-sm shadow-xs transition active:scale-[0.99]"
              >
                Gửi yêu cầu hỗ trợ
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  ← Quay lại trang đăng nhập
                </Link>
              </div>
            </form>
          )}
        </AuthCard>
      </div>
    </div>
  );
}
