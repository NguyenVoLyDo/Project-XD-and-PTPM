'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginSchema, LoginFormData } from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';

interface LoginFormProps {
  onSuccess?: () => void;
  redirectPath?: string;
}

export function LoginForm({ onSuccess, redirectPath }: LoginFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const rawRedirect = searchParams.get('redirect');
  const redirectTarget = (rawRedirect && rawRedirect.startsWith('/'))
    ? rawRedirect
    : (redirectPath && redirectPath.startsWith('/'))
    ? redirectPath
    : '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setErrorMessage(null);
      await login(data);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(redirectTarget);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="login-form">
      {errorMessage && (
        <div
          id="login-error-alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in"
        >
          <svg
            className="w-4 h-4 shrink-0 mt-0.5 text-rose-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Email input */}
      <div>
        <label
          htmlFor="login-email-input"
          className="block text-xs font-semibold text-ink mb-1.5"
        >
          Địa chỉ Email
        </label>
        <div className="relative">
          <input
            id="login-email-input"
            type="email"
            placeholder="ban@example.com"
            autoComplete="email"
            {...register('email')}
            className={`w-full px-3.5 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-subtle/70 focus:bg-surface focus:outline-none focus:ring-2 transition-all ${
              errors.email
                ? 'border-rose-500 focus:ring-rose-500/20'
                : 'border-line focus:ring-primary/20 focus:border-primary'
            }`}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email.message}</p>
        )}
      </div>

      {/* Password input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="login-password-input"
            className="block text-xs font-semibold text-ink"
          >
            Mật khẩu
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-primary hover:underline font-semibold"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <input
            id="login-password-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            className={`w-full px-3.5 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-subtle/70 focus:bg-surface focus:outline-none focus:ring-2 transition-all ${
              errors.password
                ? 'border-rose-500 focus:ring-rose-500/20'
                : 'border-line focus:ring-primary/20 focus:border-primary'
            }`}
          />
          <button
            type="button"
            id="toggle-password-visibility-btn"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-subtle hover:text-ink"
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password.message}</p>
        )}
      </div>

      {/* Remember me */}
      <div className="flex items-center">
        <input
          id="login-remember-me-checkbox"
          type="checkbox"
          {...register('rememberMe')}
          className="w-4 h-4 rounded border-line text-primary focus:ring-primary accent-primary"
        />
        <label
          htmlFor="login-remember-me-checkbox"
          className="ml-2 text-xs text-subtle"
        >
          Ghi nhớ phiên đăng nhập trên thiết bị này
        </label>
      </div>

      {/* Submit button */}
      <button
        id="login-submit-button"
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-sm shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Đang xác thực...</span>
          </>
        ) : (
          <span>Đăng nhập</span>
        )}
      </button>

      {/* Register redirect */}
      <div className="text-center pt-2">
        <p className="text-xs text-subtle">
          Chưa có tài khoản?{' '}
          <Link
            href="/register"
            id="link-to-register"
            className="font-semibold text-primary hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </form>
  );
}
