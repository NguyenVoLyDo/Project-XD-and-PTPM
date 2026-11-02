'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAuth as useDemoAuth, DEMO_ACCOUNTS } from '@/lib/auth-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, actor, logout, switchRole, isLoading } = useAuth();
  const { currentUser, switchAccount } = useDemoAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED !== 'true') {
      router.replace('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [isLoading, user, pathname, router]);

  // Loading spinner state
  if (isLoading && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED !== 'true') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6 text-subtle text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span>Đang kiểm tra quyền quản trị...</span>
        </div>
      </div>
    );
  }

  // Graceful Access Denied screen
  const isAdmin =
    actor?.activeRole === 'ADMIN' ||
    (process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && currentUser.role === 'ADMIN');
  if (!isAdmin) {
    const hasAdminRole = user?.roles?.includes('ADMIN');
    const adminDemo = DEMO_ACCOUNTS.find((a) => a.role === 'ADMIN');

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 mx-auto flex items-center justify-center">
            <Icon name="shield" width={28} height={28} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-ink">Yêu cầu quyền Quản trị viên</h1>
            <p className="text-xs text-subtle mt-1.5 leading-relaxed">
              Bạn đang đăng nhập với vai trò{' '}
              <strong className="text-ink font-semibold">{actor?.activeRole || 'Chưa xác định'}</strong>.
              Trang này chỉ dành cho tài khoản Quản trị viên (Admin) của hệ thống DropConnect.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            {hasAdminRole && (
              <Button
                variant="default"
                size="md"
                className="w-full"
                onClick={async () => {
                  try {
                    await switchRole('ADMIN');
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Chuyển sang vai trò Admin
              </Button>
            )}

            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && adminDemo && (
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={async () => {
                  await switchAccount(adminDemo);
                }}
              >
                Trải nghiệm với tài khoản Admin Demo
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => router.push('/login?redirect=' + encodeURIComponent(pathname))}
            >
              Đăng nhập tài khoản Quản trị viên khác
            </Button>

            <Link
              href="/"
              className="inline-block text-xs font-semibold text-subtle hover:text-ink pt-2 transition-colors"
            >
              ← Quay về trang chủ mua sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ href: string; label: string; icon: 'chart' | 'users' | 'clipboard' | 'shield' }> = [
    { href: '/admin', label: 'Tổng quan hệ thống', icon: 'chart' },
    { href: '/admin/users', label: 'Quản lý người dùng', icon: 'users' },
    { href: '/admin/profiles', label: 'Xét duyệt hồ sơ', icon: 'clipboard' },
    { href: '/admin/audit', label: 'Nhật ký kiểm toán', icon: 'shield' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-surface border-r border-line flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-line flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-xs transition-transform group-hover:scale-105">
              <Icon name="box" width={20} height={20} />
            </span>
            <div>
              <span className="font-extrabold text-ink text-base tracking-tight block leading-tight">
                Drop<span className="text-primary">Connect</span>
              </span>
              <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                Cổng Quản Trị
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-3.5 space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-soft text-primary border border-primary/20 shadow-xs'
                    : 'text-subtle hover:text-ink hover:bg-muted'
                }`}
              >
                <Icon name={item.icon} width={16} height={16} className={isActive ? 'text-primary' : 'text-subtle'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer profile info & store return */}
        <div className="p-3.5 border-t border-line bg-canvas/60 space-y-2.5">
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-ink truncate leading-tight">
                {user?.email || 'Quản trị viên'}
              </p>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-soft text-primary mt-0.5">
                ADMIN
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <Link
              href="/"
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-surface border border-line hover:bg-muted text-subtle hover:text-ink text-xs font-semibold text-center transition"
            >
              ← Về sàn
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="py-1.5 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center gap-1"
            >
              <Icon name="logout" width={14} height={14} />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-line bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-subtle">
            <Link href="/admin" className="hover:text-ink">Quản Trị</Link>
            <span>/</span>
            <span className="text-ink font-semibold">
              {navItems.find((i) =>
                i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href)
              )?.label || 'Bảng điều khiển'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-subtle font-medium">Hệ thống bình thường</span>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
