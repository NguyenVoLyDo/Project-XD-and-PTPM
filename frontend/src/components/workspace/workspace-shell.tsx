'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAuth as useDemoAuth, DEMO_ACCOUNTS } from '@/lib/auth-context';
import { Icon, type IconName } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { RoleType } from '@/features/auth/types';

export interface WorkspaceMenuItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

interface WorkspaceShellProps {
  role: 'ADMIN' | 'SELLER' | 'SUPPLIER';
  title: string;
  subtitle: string;
  menuItems: WorkspaceMenuItem[];
  children: React.ReactNode;
}

export function WorkspaceShell({
  role,
  title,
  subtitle,
  menuItems,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, actor, logout, switchRole, isLoading } = useAuth();
  const { currentUser, switchAccount } = useDemoAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Loading state
  if (isLoading && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED !== 'true') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6 text-subtle text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="font-medium text-slate-600">Đang kiểm tra quyền truy cập không gian {title}...</span>
        </div>
      </div>
    );
  }

  // Check role authorization
  const activeRole = actor?.activeRole || currentUser?.role;
  const isAuthorized =
    activeRole === role ||
    (process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && currentUser.role === role);

  if (!isAuthorized) {
    const hasRole = user?.roles?.includes(role as RoleType);
    const demoForRole = DEMO_ACCOUNTS.find((a) => a.role === role);

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-warning-soft text-warning border border-warning/30 mx-auto flex items-center justify-center shadow-xs">
            <Icon name="shield" width={28} height={28} />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-warning bg-warning-soft px-2.5 py-1 rounded-full border border-warning/30">
              Yêu cầu quyền {title}
            </span>
            <h1 className="text-xl font-bold text-ink mt-3">Chuyển sang không gian {title}</h1>
            <p className="text-xs text-subtle mt-2 leading-relaxed">
              Bạn đang ở phiên đăng nhập với vai trò <strong className="text-ink font-semibold">{activeRole || 'Khách hàng'}</strong>.
              Vui lòng chuyển đổi vai trò hoặc tài khoản để tiếp tục làm việc.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            {hasRole && (
              <Button
                variant="default"
                size="md"
                className="w-full"
                onClick={async () => {
                  try {
                    await switchRole(role as RoleType);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Kích hoạt vai trò {title}
              </Button>
            )}

            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && demoForRole && (
              <Button
                variant="default"
                size="md"
                className="w-full bg-primary hover:bg-primary-hover text-white"
                onClick={async () => {
                  await switchAccount(demoForRole);
                }}
              >
                Trải nghiệm với tài khoản {demoForRole.name}
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => router.push('/login?redirect=' + encodeURIComponent(pathname))}
            >
              Đăng nhập tài khoản khác
            </Button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-subtle hover:text-primary pt-2 transition-colors"
            >
              <Icon name="arrow" width={14} height={14} className="rotate-180" />
              <span>Quay về Sàn mua sắm</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleBadgeStyle =
    role === 'ADMIN'
      ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
      : role === 'SELLER'
      ? 'bg-teal-500/20 text-teal-300 border-teal-400/30'
      : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30';

  const roleAccentColor =
    role === 'ADMIN' ? 'bg-primary' : role === 'SELLER' ? 'bg-accent' : 'bg-indigo-600';

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row antialiased">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-navy/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 md:z-20 bg-navy text-slate-100 border-r border-navy-soft/60 flex flex-col shrink-0 transition-all duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 px-4 border-b border-navy-soft/60 flex items-center justify-between gap-3">
          <Link
            href={menuItems[0]?.href || '/'}
            className={`flex items-center gap-2.5 overflow-hidden transition-opacity ${
              collapsed ? 'justify-center w-full' : ''
            }`}
          >
            <span
              className={`w-9 h-9 rounded-xl ${roleAccentColor} text-white flex items-center justify-center font-bold shadow-xs shrink-0`}
            >
              <Icon name="box" width={18} height={18} />
            </span>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <span className="font-extrabold text-white text-base tracking-tight leading-tight block truncate">
                  Drop<span className="text-blue-400">Connect</span>
                </span>
                <span
                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border mt-0.5 ${roleBadgeStyle}`}
                >
                  {title}
                </span>
              </div>
            )}
          </Link>

          {/* Close button for Mobile drawer */}
          <button
            type="button"
            aria-label="Đóng bảng điều hướng"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-surface transition"
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : item.href === '/admin' || item.href === '/seller/listings' || item.href === '/supplier/products'
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-navy-surface'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  name={item.icon}
                  width={18}
                  height={18}
                  className={`shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (Profile, Store Return, Logout) */}
        <div className="p-3 border-t border-navy-soft/60 bg-navy/80 space-y-2">
          {!collapsed ? (
            <>
              {/* User Identity Info */}
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-navy-surface/60 border border-navy-soft/40">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-400/30 flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {currentUser?.name || user?.email || 'Đối tác'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {user?.email || currentUser?.email || 'Tài khoản hoạt động'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/"
                  className="py-1.5 px-2 rounded-lg bg-navy-surface hover:bg-navy-soft text-slate-300 hover:text-white text-[11px] font-semibold text-center border border-navy-soft/60 transition flex items-center justify-center gap-1"
                >
                  <Icon name="arrow" width={12} height={12} className="rotate-180" />
                  <span>Về Sàn</span>
                </Link>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="py-1.5 px-2 rounded-lg text-danger hover:bg-danger-soft/20 text-[11px] font-semibold transition flex items-center justify-center gap-1 border border-danger/30"
                >
                  <Icon name="logout" width={12} height={12} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/"
                title="Về Sàn mua sắm"
                className="w-10 h-10 rounded-xl bg-navy-surface hover:bg-navy-soft text-slate-300 hover:text-white flex items-center justify-center transition border border-navy-soft/60"
              >
                <Icon name="arrow" width={16} height={16} className="rotate-180" />
              </Link>
              <button
                type="button"
                title="Đăng xuất"
                onClick={() => logout()}
                className="w-10 h-10 rounded-xl text-danger hover:bg-danger-soft/20 flex items-center justify-center transition border border-danger/30"
              >
                <Icon name="logout" width={16} height={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Workspace Topbar */}
        <header className="h-16 border-b border-line bg-surface/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile Toggle, Desktop Collapse & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              aria-label="Mở bảng điều hướng"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl text-subtle hover:text-ink hover:bg-muted border border-line transition shrink-0"
            >
              <Icon name="menu" width={18} height={18} />
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-xl text-subtle hover:text-ink hover:bg-muted border border-line transition shrink-0"
            >
              <Icon name="sidebar" width={18} height={18} />
            </button>

            {/* Breadcrumb Path */}
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="text-subtle font-medium hidden sm:inline">{title}</span>
              <span className="text-line hidden sm:inline">/</span>
              <h1 className="text-ink font-bold truncate">
                {menuItems.find((i) =>
                  i.exact
                    ? pathname === i.href
                    : i.href === '/admin' || i.href === '/seller/listings' || i.href === '/supplier/products'
                    ? pathname === i.href
                    : pathname.startsWith(i.href),
                )?.label || subtitle}
              </h1>
            </div>
          </div>

          {/* Right: Status, Demo Switcher, Quick Links */}
          <div className="flex items-center gap-3 shrink-0">
            {/* System Online Status */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft border border-success/25 text-success text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Hệ thống trực tuyến</span>
            </div>

            {/* Demo Quick Account Switcher */}
            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-subtle hidden sm:inline">Vai trò:</span>
                <select
                  aria-label="Chọn tài khoản trải nghiệm"
                  value={currentUser?.id}
                  onChange={(e) => {
                    const acc = DEMO_ACCOUNTS.find((a) => a.id === e.target.value);
                    if (acc) {
                      switchAccount(acc);
                      if (acc.role === 'SELLER') router.push('/seller/listings');
                      else if (acc.role === 'SUPPLIER') router.push('/supplier/products');
                      else if (acc.role === 'ADMIN') router.push('/admin');
                      else router.push('/');
                    }
                  }}
                  className="h-8 text-xs bg-canvas rounded-lg border border-line px-2 font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {DEMO_ACCOUNTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.badge})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Storefront Link Pill */}
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-line hover:border-primary/40 hover:bg-primary-soft text-subtle hover:text-primary text-xs font-semibold transition"
            >
              <span>Xem Sàn</span>
              <Icon name="externalLink" width={13} height={13} />
            </Link>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
