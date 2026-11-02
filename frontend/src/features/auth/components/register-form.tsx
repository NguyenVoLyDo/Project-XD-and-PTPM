'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerSchema, RegisterFormData } from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerAuth } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: 'CUSTOMER',
      agreeTerms: false,
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setErrorMessage(null);
      await registerAuth(data);
      router.push('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" id="register-form">
      {errorMessage && (
        <div
          id="register-error-alert"
          className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2.5 animate-in fade-in"
        >
          <svg
            className="w-5 h-5 shrink-0 mt-0.5 text-red-500"
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

      {/* Role Selection */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          Chọn vai trò tài khoản
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: 'role-customer',
              value: 'CUSTOMER' as const,
              label: 'Khách mua',
              desc: 'Mua sắm online',
            },
            {
              id: 'role-seller',
              value: 'SELLER' as const,
              label: 'Người bán',
              desc: 'Mở gian hàng',
            },
            {
              id: 'role-supplier',
              value: 'SUPPLIER' as const,
              label: 'Nhà cung cấp',
              desc: 'Quản lý nguồn hàng',
            },
          ].map((item) => {
            const isSelected = selectedRole === item.value;
            return (
              <button
                key={item.value}
                id={item.id}
                type="button"
                onClick={() => setValue('role', item.value)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold leading-tight">{item.label}</div>
                <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
              </button>
            );
          })}
        </div>
        {selectedRole !== 'CUSTOMER' && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            ℹ️ Lưu ý: Hồ sơ {selectedRole === 'SELLER' ? 'Người bán' : 'Nhà cung cấp'} sẽ ở trạng thái chờ Admin xét duyệt trước khi được tạo Listing/Sản phẩm.
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="register-email-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
        >
          Địa chỉ Email
        </label>
        <input
          id="register-email-input"
          type="email"
          placeholder="ban@example.com"
          autoComplete="email"
          {...register('email')}
          className={`w-full px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
            errors.email
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500'
          }`}
        />
        {errors.email && (
          <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="register-password-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
        >
          Mật khẩu
        </label>
        <div className="relative">
          <input
            id="register-password-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="Tối thiểu 8 ký tự, có chữ hoa và số"
            autoComplete="new-password"
            {...register('password')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.password
                ? 'border-red-500 focus:ring-red-500/30'
                : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
          <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label
          htmlFor="register-confirm-password-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
        >
          Xác nhận mật khẩu
        </label>
        <input
          id="register-confirm-password-input"
          type={showPassword ? 'text' : 'password'}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className={`w-full px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
            errors.confirmPassword
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500'
          }`}
        />
        {errors.confirmPassword && (
          <p className="mt-1.5 text-xs text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms & Conditions */}
      <div>
        <div className="flex items-start">
          <input
            id="register-agree-terms-checkbox"
            type="checkbox"
            {...register('agreeTerms')}
            className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="register-agree-terms-checkbox"
            className="ml-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
          >
            Tôi đồng ý với{' '}
            <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Điều khoản dịch vụ
            </a>{' '}
            và{' '}
            <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Chính sách bảo mật
            </a>{' '}
            của DropConnect.
          </label>
        </div>
        {errors.agreeTerms && (
          <p className="mt-1.5 text-xs text-red-500">{errors.agreeTerms.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        id="register-submit-button"
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all duration-200 transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Đang tạo tài khoản...</span>
          </>
        ) : (
          <span>Tạo tài khoản ngay</span>
        )}
      </button>

      {/* Login redirect */}
      <div className="text-center pt-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            id="link-to-login"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </form>
  );
}
