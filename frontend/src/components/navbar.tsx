'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, DEMO_ACCOUNTS } from '../lib/auth-context';
import { Icon } from './ui/icon';
import { useAuth as useIdentity } from '../features/auth/hooks/use-auth';
import type { RoleType } from '../features/auth/types';

export function Navbar() {
  const { currentUser, switchAccount, cartCount } = useAuth();
  const identity = useIdentity();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      router.push(`/catalog?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    } else {
      router.push('/catalog');
    }
  };

  const handleRoleSwitch = async (role: RoleType) => {
    try {
      setRoleError(null);
      await identity.switchRole(role);
      setUserDropdownOpen(false);
      // Auto contextual redirection when switching role
      if (role === 'SELLER') {
        router.push('/seller/listings');
      } else if (role === 'SUPPLIER') {
        router.push('/supplier/products');
      } else if (role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : 'Không đổi được vai trò');
      setTimeout(() => setRoleError(null), 4000);
    }
  };

  const mainLinks =
    currentUser.role === 'ADMIN'
      ? [
          { href: '/admin', label: 'Cổng Quản trị' },
          { href: '/admin/users', label: 'Quản lý người dùng' },
          { href: '/admin/profiles', label: 'Xét duyệt hồ sơ' },
          { href: '/admin/audit', label: 'Nhật ký kiểm toán' },
        ]
      : currentUser.role === 'SELLER'
      ? [
          { href: '/seller/listings', label: 'Quản lý gian hàng' },
          { href: '/seller/sourcing', label: 'Khám phá nguồn hàng' },
          { href: '/orders', label: 'Theo dõi đơn bán' },
        ]
      : currentUser.role === 'SUPPLIER'
      ? [
          { href: '/supplier/products', label: 'Sản phẩm & Tồn kho' },
          { href: '/supplier/orders', label: 'Đơn hàng cần xử lý' },
          { href: '/supplier/market', label: 'Thị trường bán lẻ' },
        ]
      : [
          { href: '/', label: 'Trang chủ' },
          { href: '/catalog', label: 'Khám phá' },
          { href: '/orders', label: 'Đơn mua của tôi' },
        ];

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line">
      {/* Toast Alert for Role Error */}
      {roleError && (
        <div
          role="alert"
          className="fixed top-14 right-6 z-50 px-4 py-2.5 rounded-xl bg-danger text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in"
        >
          <span>{roleError}</span>
          <button type="button" onClick={() => setRoleError(null)} className="ml-2 underline">
            Đóng
          </button>
        </div>
      )}

      {/* 1. Top Utility Strip: Minimalist, clean, secondary actions */}
      <div className="bg-canvas border-b border-line/60 text-[11px] text-subtle overflow-hidden">
        <div className="page-shell flex items-center justify-between h-8">
          {/* Left partner links - hidden on small mobile to prevent horizontal overflow */}
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/seller/listings"
              className="hover:text-ink transition-colors font-medium"
            >
              Kênh Người Bán
            </Link>
            <span className="text-line">|</span>
            <Link
              href="/supplier/products"
              className="hover:text-ink transition-colors font-medium"
            >
              Kênh Nhà Cung Cấp
            </Link>
            <span className="text-line">|</span>
            <span className="text-subtle/80">
              Hotline hỗ trợ: 1900 8888
            </span>
          </div>

          {/* Right quick switch / demo switcher */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-subtle/70">Demo:</span>
                <select
                  id="demo-account"
                  aria-label="Bản demo"
                  value={currentUser.id}
                  onChange={(e) => {
                    const account = DEMO_ACCOUNTS.find((item) => item.id === e.target.value);
                    if (account) {
                      switchAccount(account);
                      if (account.role === 'SELLER') {
                        router.push('/seller/listings');
                      } else if (account.role === 'SUPPLIER') {
                        router.push('/supplier/products');
                      } else if (account.role === 'ADMIN') {
                        router.push('/admin');
                      } else {
                        router.push('/');
                      }
                    }
                  }}
                  className="h-6 text-[11px] bg-surface rounded-md border border-line px-1.5 font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DEMO_ACCOUNTS.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.badge})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main E-Commerce Navbar */}
      <div className="page-shell py-3 flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand Logo - Minimalist & Modern */}
        <Link
          href="/"
          aria-label="DropConnect — Trang chủ"
          className="flex items-center gap-2 shrink-0 group"
        >
          <span className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <Icon name="box" width={18} height={18} />
          </span>
          <span className="font-extrabold text-xl tracking-tight text-ink">
            Drop<span className="text-primary">Connect</span>
          </span>
        </Link>

        {/* Central Search Bar with Trending Search Tags */}
        <div className="flex-1 max-w-xl hidden md:flex flex-col">
          <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm, phụ kiện, nhà cung cấp..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full h-10 pl-4 pr-10 rounded-full bg-canvas border border-line text-xs text-ink placeholder:text-subtle/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            <button
              type="submit"
              aria-label="Tìm kiếm"
              className="absolute right-1 top-1 bottom-1 w-8 h-8 rounded-full flex items-center justify-center text-subtle hover:text-ink hover:bg-muted transition"
            >
              <Icon name="search" width={16} height={16} />
            </button>
          </form>

          {/* Trending Search Keywords */}
          <div className="flex items-center gap-3 mt-1.5 px-3 text-[11px] text-subtle">
            <span className="text-subtle/60 text-[10px] font-medium">Gợi ý:</span>
            {[
              { label: 'Tai nghe', query: 'tai nghe' },
              { label: 'Cáp sạc GaN', query: 'sac' },
              { label: 'Bình giữ nhiệt', query: 'binh' },
            ].map((tag) => (
              <Link
                key={tag.label}
                href={`/catalog?q=${encodeURIComponent(tag.query)}`}
                className="text-subtle hover:text-primary transition-colors"
              >
                {tag.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Actions: Orders, Cart, User Profile */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Quick Orders Link for customers */}
          {currentUser.role === 'CUSTOMER' && (
            <Link
              href="/orders"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink transition-colors px-2 py-1.5 rounded-lg hover:bg-muted"
            >
              <Icon name="receipt" width={16} height={16} />
              <span>Đơn hàng</span>
            </Link>
          )}

          {/* Cart Icon Button */}
          {currentUser.role === 'CUSTOMER' && (
            <Link
              href="/cart"
              aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
              className="relative p-2 rounded-xl text-ink hover:text-primary hover:bg-muted transition-colors"
            >
              <Icon name="bag" width={22} height={22} />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-primary text-on-primary rounded-full min-w-4.5 h-4.5 px-1 text-[10px] font-bold flex items-center justify-center tabular">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {/* User Account / Profile Dropdown */}
          {identity.isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-line hover:border-primary/40 hover:bg-muted transition text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center font-bold text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-ink leading-tight max-w-28 truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-subtle uppercase tracking-wider leading-none mt-0.5">
                    {identity.actor?.activeRole || currentUser.role}
                  </div>
                </div>
                <Icon name="chevron" width={12} height={12} className="text-subtle hidden sm:block" />
              </button>

              {/* User Menu Popover */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface rounded-2xl border border-line shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 space-y-2.5">
                  <div className="pb-2.5 border-b border-line">
                    <div className="text-xs font-bold text-ink truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-subtle truncate">{currentUser.email}</div>
                    <div className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary-soft text-primary border border-primary/20">
                      Vai trò: {identity.actor?.activeRole || currentUser.role}
                    </div>
                  </div>

                  {/* Role Switcher if multi-role */}
                  {identity.user && identity.user.roles && identity.user.roles.length > 1 && (
                    <div className="pb-2.5 border-b border-line">
                      <div className="text-[11px] font-semibold text-subtle mb-1.5">
                        Chuyển đổi vai trò:
                      </div>
                      <div className="space-y-1">
                        {identity.user.roles.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => handleRoleSwitch(r)}
                            disabled={identity.isLoading}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              identity.actor?.activeRole === r
                                ? 'bg-primary text-on-primary font-bold'
                                : 'text-subtle hover:bg-muted hover:text-ink'
                            }`}
                          >
                            <span>{r}</span>
                            {identity.actor?.activeRole === r && (
                              <Icon name="check" width={14} height={14} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation links by role */}
                  <div className="space-y-0.5 text-xs">
                    {currentUser.role === 'SELLER' && (
                      <>
                        <Link
                          href="/seller/listings"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                        >
                          Quản lý gian hàng
                        </Link>
                        <Link
                          href="/seller/sourcing"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                        >
                          Khám phá nguồn hàng
                        </Link>
                      </>
                    )}
                    {currentUser.role === 'SUPPLIER' && (
                      <>
                        <Link
                          href="/supplier/products"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                        >
                          Sản phẩm & Tồn kho
                        </Link>
                        <Link
                          href="/supplier/market"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                        >
                          Thị trường bán lẻ
                        </Link>
                      </>
                    )}
                    {currentUser.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                      >
                        Cổng quản trị
                      </Link>
                    )}
                    <Link
                      href="/orders"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                    >
                      Đơn hàng của tôi
                    </Link>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        void identity.logout().catch((err) =>
                          setRoleError(err instanceof Error ? err.message : 'Lỗi đăng xuất')
                        );
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-danger-soft flex items-center gap-1.5 transition"
                    >
                      <Icon name="logout" width={14} height={14} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs font-semibold text-subtle hover:text-ink px-3 py-1.5 rounded-lg hover:bg-muted transition"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="text-xs font-semibold bg-primary hover:bg-primary-hover text-on-primary px-3 py-1.5 rounded-lg transition"
              >
                Đăng ký
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-xl border border-line text-ink hover:bg-muted transition"
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} width={18} height={18} />
          </button>
        </div>
      </div>

      {/* 3. Category Subnav - Clean, Flat Typography Links */}
      <nav aria-label="Danh mục điều hướng chính" className="hidden lg:block border-t border-line/70">
        <div className="page-shell flex items-center gap-6 overflow-x-auto h-10 scrollbar-none">
          {mainLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`text-xs font-semibold whitespace-nowrap transition-colors relative py-2.5 ${
                  isActive
                    ? 'text-primary font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                    : 'text-subtle hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Điều hướng di động"
          className="lg:hidden border-t border-line bg-surface p-4 space-y-3 shadow-lg animate-in slide-in-from-top-2"
        >
          {/* Mobile Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              aria-label="Tìm kiếm"
              className="absolute right-1 top-1 bottom-1 w-8 h-8 rounded-lg flex items-center justify-center text-subtle hover:text-ink hover:bg-muted transition"
            >
              <Icon name="search" width={15} height={15} />
            </button>
          </form>

          {/* Links List */}
          <div className="flex flex-col gap-0.5 pt-1">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                  pathname === link.href
                    ? 'bg-primary-soft text-primary'
                    : 'text-subtle hover:bg-muted hover:text-ink'
                }`}
              >
                <span>{link.label}</span>
                <Icon name="arrow" width={13} height={13} />
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
