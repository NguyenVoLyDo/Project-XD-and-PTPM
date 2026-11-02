'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../../features/auth/schemas/auth.schema';
import { useAuth as useIdentity } from '../../features/auth/hooks/use-auth';
import { useAuth, DEMO_ACCOUNTS } from '../../lib/auth-context';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';
import Link from 'next/link';

interface LoginModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  redirectUrl?: string;
  actionMessage?: string;
}

export function LoginModal({
  onClose,
  onSuccess,
  redirectUrl,
  actionMessage = 'Đăng nhập tài khoản Khách hàng để thêm vào giỏ và đặt hàng',
}: LoginModalProps) {
  const { login, isLoading } = useIdentity();
  const { switchAccount } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setErrorMessage(null);
      await login(data);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  const handleQuickDemo = async (account: typeof DEMO_ACCOUNTS[0]) => {
    try {
      setErrorMessage(null);
      await switchAccount(account);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể chọn tài khoản demo.');
    }
  };

  return (
    <Modal
      title="Đăng nhập tài khoản"
      subtitle={actionMessage}
      onClose={onClose}
      maxWidth="sm"
    >
      <div className="space-y-5">
        {/* Error notice */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <Icon name="alert" width={16} height={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Demo Fast Login Pills (If demo is enabled) */}
        {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && (
          <div className="p-3.5 rounded-2xl bg-canvas border border-line space-y-2">
            <span className="text-[11px] font-semibold text-subtle block uppercase tracking-wider">
              Chọn nhanh tài khoản Demo:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleQuickDemo(acc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                    acc.role === 'CUSTOMER'
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface text-ink border-line hover:border-primary/40'
                  }`}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
              Địa chỉ Email
            </label>
            <input
              type="email"
              placeholder="customer@gmail.com"
              autoComplete="email"
              {...register('email')}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-canvas text-ink placeholder:text-subtle text-sm focus:bg-surface focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-rose-500 focus:ring-rose-500/30'
                  : 'border-line focus:ring-primary'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-subtle">
                Mật khẩu
              </label>
              <Link
                href="/auth/forgot-password"
                onClick={onClose}
                className="text-xs text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-canvas text-ink placeholder:text-subtle text-sm focus:bg-surface focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-line focus:ring-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink text-xs"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <Link
              href={`/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
              onClick={onClose}
              className="text-xs text-subtle hover:text-primary underline"
            >
              Mở trang đăng nhập đầy đủ →
            </Link>
            <Button type="submit" variant="default" isLoading={isSubmitting || isLoading}>
              Đăng nhập ngay
            </Button>
          </div>
        </form>

        {/* Register link */}
        <div className="pt-2 text-center border-t border-line text-xs text-subtle">
          <span>Chưa có tài khoản? </span>
          <Link
            href={`/register${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
            onClick={onClose}
            className="font-bold text-primary hover:underline"
          >
            Đăng ký tài khoản mới
          </Link>
        </div>
      </div>
    </Modal>
  );
}
