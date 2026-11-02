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
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md z-10">
        <AuthCard
          title="Khôi phục mật khẩu"
          subtitle="Chức năng gửi email khôi phục chưa khả dụng"
        >
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                Hệ thống chưa hỗ trợ gửi email đặt lại mật khẩu. Vui lòng liên hệ quản trị viên để được hỗ trợ tài khoản.
              </div>
              <Link
                href="/login"
                className="inline-block py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all"
              >
                Xem hướng dẫn hỗ trợ
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-sm font-medium text-indigo-400 hover:underline"
                >
                  ← Quay lại trang đăng nhập
                </Link>
              </div>
            </form>
          )}
        </AuthCard>
      </div>
    </main>
  );
}
