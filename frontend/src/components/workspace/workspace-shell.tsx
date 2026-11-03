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

export const ADMIN_MENU_ITEMS: WorkspaceMenuItem[] = [
  { href: '/admin', label: 'Tổng quan hệ thống', icon: 'chart', exact: true },
  { href: '/admin/users', label: 'Quản lý người dùng', icon: 'users' },
  { href: '/admin/profiles', label: 'Xét duyệt hồ sơ KYC', icon: 'clipboard' },
  { href: '/customer/disputes', label: 'Xử lý khiếu nại sàn', icon: 'alert' },
  { href: '/supplier/finance', label: 'Đối soát Nhà cung cấp', icon: 'box' },
  { href: '/seller/finance', label: 'Đối soát Người bán', icon: 'store' },
  { href: '/admin/audit', label: 'Nhật ký kiểm toán', icon: 'shield' },
  { href: '/notifications', label: 'Thông báo hệ thống', icon: 'bell' },
];

export const SELLER_MENU_ITEMS: WorkspaceMenuItem[] = [
  { href: '/seller/listings', label: 'Gian hàng & Niêm yết', icon: 'store' },
  { href: '/seller/sourcing', label: 'Khám phá nguồn hàng', icon: 'search' },
  { href: '/seller/orders', label: 'Đơn hàng bán lẻ', icon: 'receipt' },
  { href: '/seller/finance', label: 'Doanh thu & Đối soát', icon: 'wallet' },
  { href: '/notifications', label: 'Thông báo', icon: 'bell' },
];

export const SUPPLIER_MENU_ITEMS: WorkspaceMenuItem[] = [
  { href: '/supplier/products', label: 'Sản phẩm & Tồn kho', icon: 'box' },
  { href: '/supplier/orders', label: 'Đơn hàng cần xử lý', icon: 'truck' },
  { href: '/supplier/finance', label: 'Tài chính & Đối soát', icon: 'wallet' },
  { href: '/customer/disputes', label: 'Khiếu nại & Hàng hoàn', icon: 'refresh' },
  { href: '/supplier/market', label: 'Thị trường phân phối', icon: 'chart' },
  { href: '/notifications', label: 'Thông báo', icon: 'bell' },
];

export const WORKSPACE_CONFIG: Record<
  'ADMIN' | 'SELLER' | 'SUPPLIER',
  { title: string; subtitle: string; menuItems: WorkspaceMenuItem[] }
> = {
  ADMIN: {
    title: 'Quản Trị Viên',
    subtitle: 'Bảng điều khiển hệ thống',
    menuItems: ADMIN_MENU_ITEMS,
  },
  SELLER: {
    title: 'Người Bán',
    subtitle: 'Kênh quản lý gian hàng',
    menuItems: SELLER_MENU_ITEMS,
  },
  SUPPLIER: {
    title: 'Nhà Cung Cấp',
    subtitle: 'Kênh vận hành kho nguồn',
    menuItems: SUPPLIER_MENU_ITEMS,
  },
};

interface WorkspaceShellProps {
  role: 'ADMIN' | 'SELLER' | 'SUPPLIER';
  title?: string;
  subtitle?: string;
  menuItems?: WorkspaceMenuItem[];
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoading && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED !== 'true') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6 text-subtle text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-ink animate-spin" />
          <span className="font-medium text-subtle">Đang kiểm tra quyền truy cập...</span>
        </div>
      </div>
    );
  }

  const activeRole = actor?.activeRole || currentUser?.role;

  // Allow ADMIN to inspect finance / dispute routes while keeping ADMIN's own workspace layout
  const isAdminSharedRoute =
    activeRole === 'ADMIN' &&
    (pathname.startsWith('/supplier/finance') ||
      pathname.startsWith('/seller/finance') ||
      pathname.startsWith('/customer/disputes') ||
      pathname.startsWith('/notifications'));

  const effectiveRole: 'ADMIN' | 'SELLER' | 'SUPPLIER' = isAdminSharedRoute ? 'ADMIN' : role;
  const config = WORKSPACE_CONFIG[effectiveRole];
  const resolvedTitle = isAdminSharedRoute ? config.title : title || config.title;
  const resolvedSubtitle = isAdminSharedRoute ? config.subtitle : subtitle || config.subtitle;
  const resolvedMenu = isAdminSharedRoute ? config.menuItems : menuItems || config.menuItems;

  const isAuthorized =
    activeRole === effectiveRole ||
    isAdminSharedRoute ||
    (process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && currentUser.role === effectiveRole);

  if (!isAuthorized) {
    const hasRole = user?.roles?.includes(effectiveRole as RoleType);
    const demoForRole = DEMO_ACCOUNTS.find((a) => a.role === effectiveRole);

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-canvas text-ink border border-line mx-auto flex items-center justify-center">
            <Icon name="lock" width={22} height={22} />
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle bg-canvas px-2.5 py-1 rounded-md border border-line">
              Yêu cầu quyền {resolvedTitle}
            </span>
            <h1 className="text-xl font-bold text-ink mt-3">Chuyển sang không gian {resolvedTitle}</h1>
            <p className="text-xs text-subtle mt-2 leading-relaxed">
              Bạn đang ở phiên làm việc với vai trò{' '}
              <strong className="text-ink font-semibold">{activeRole || 'Khách hàng'}</strong>. Vui lòng
              chuyển đổi vai trò hoặc tài khoản để tiếp tục.
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
                    await switchRole(effectiveRole as RoleType);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Kích hoạt vai trò {resolvedTitle}
              </Button>
            )}

            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && demoForRole && (
              <Button
                variant="default"
                size="md"
                className="w-full"
                onClick={async () => {
                  await switchAccount(demoForRole);
                }}
              >
                Chuyển sang {demoForRole.name}
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

            {activeRole === 'CUSTOMER' && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-subtle hover:text-ink pt-2 transition-colors"
              >
                <Icon name="arrow" width={14} height={14} className="rotate-180" />
                <span>Quay về Trang mua sắm</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row antialiased">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-ink/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Minimalist Light Surface Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 md:z-20 bg-surface text-ink border-r border-line flex flex-col shrink-0 transition-all duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 px-4 border-b border-line flex items-center justify-between gap-3">
          <Link
            href={resolvedMenu[0]?.href || '/'}
            className={`flex items-center gap-2.5 overflow-hidden ${
              collapsed ? 'justify-center w-full' : ''
            }`}
          >
            <span className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center shrink-0">
              <Icon name="box" width={16} height={16} />
            </span>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <span className="font-bold text-ink text-sm tracking-tight leading-tight block truncate">
                  DropConnect
                </span>
                <span className="text-[10px] font-medium text-subtle block truncate">
                  {resolvedTitle}
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            aria-label="Đóng bảng điều hướng"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav aria-label="Điều hướng không gian làm việc" className="p-3 space-y-1 flex-1 overflow-y-auto">
          {resolvedMenu.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-ink text-white font-semibold'
                    : 'text-subtle hover:text-ink hover:bg-canvas'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  name={item.icon}
                  width={17}
                  height={17}
                  className={`shrink-0 ${
                    isActive ? 'text-white' : 'text-subtle group-hover:text-ink'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (User Profile & Logout) */}
        <div className="p-3 border-t border-line bg-canvas/50 space-y-2">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface border border-line">
                <div className="w-7 h-7 rounded-lg bg-canvas text-ink border border-line flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink truncate leading-tight">
                    {currentUser?.name || user?.email || 'Tài khoản'}
                  </p>
                  <p className="text-[10px] text-subtle truncate mt-0.5">
                    {user?.email || currentUser?.email || resolvedTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 px-3 rounded-xl bg-surface hover:bg-muted text-subtle hover:text-ink text-xs font-medium transition flex items-center justify-center gap-1.5 border border-line"
              >
                <Icon name="logout" width={14} height={14} />
                <span>Đăng xuất</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                title="Đăng xuất"
                onClick={() => logout()}
                className="w-10 h-10 rounded-xl bg-surface hover:bg-muted text-subtle hover:text-ink flex items-center justify-center transition border border-line"
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
        <header className="h-16 border-b border-line bg-surface sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Mở bảng điều hướng"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl text-subtle hover:text-ink hover:bg-muted border border-line transition shrink-0"
            >
              <Icon name="menu" width={18} height={18} />
            </button>

            <button
              type="button"
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-xl text-subtle hover:text-ink hover:bg-muted border border-line transition shrink-0"
            >
              <Icon name="sidebar" width={17} height={17} />
            </button>

            <div className="flex items-center gap-2 text-xs truncate">
              <span className="text-subtle font-medium hidden sm:inline">{resolvedTitle}</span>
              <span className="text-line hidden sm:inline">/</span>
              <span className="text-ink font-semibold truncate">
                {resolvedMenu.find((i) =>
                  i.exact
                    ? pathname === i.href
                    : pathname === i.href || pathname.startsWith(i.href + '/'),
                )?.label || resolvedSubtitle}
              </span>
            </div>
          </div>

          {/* Right Actions: Role Switcher & Notifications */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Multi-role switcher for authenticated real users */}
            {user?.roles && user.roles.length > 1 && (
              <select
                aria-label="Chuyển đổi vai trò"
                value={actor?.activeRole || effectiveRole}
                onChange={async (e) => {
                  const nextRole = e.target.value as RoleType;
                  await switchRole(nextRole);
                  if (nextRole === 'SELLER') router.push('/seller/listings');
                  else if (nextRole === 'SUPPLIER') router.push('/supplier/products');
                  else if (nextRole === 'ADMIN') router.push('/admin');
                  else router.push('/');
                }}
                className="h-8 text-xs bg-canvas rounded-lg border border-line px-2.5 font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {user.roles.map((r) => (
                  <option key={r} value={r}>
                    Vai trò: {r}
                  </option>
                ))}
              </select>
            )}

            {/* Demo Quick Account Switcher */}
            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-subtle hidden sm:inline">Tài khoản:</span>
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
                  className="h-8 text-xs bg-canvas rounded-lg border border-line px-2.5 font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DEMO_ACCOUNTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.badge})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Link
              href="/notifications"
              aria-label="Thông báo"
              className="p-2 rounded-xl border border-line bg-surface hover:bg-canvas text-subtle hover:text-ink transition"
            >
              <Icon name="bell" width={16} height={16} />
            </Link>
          </div>
        </header>

        {/* Content Viewport */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
