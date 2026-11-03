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

  const storefrontLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/catalog', label: 'Khám phá sản phẩm' },
    { href: '/orders', label: 'Đơn mua của tôi' },
    { href: '/customer/disputes', label: 'Khiếu nại & Đổi trả' },
    { href: '/notifications', label: 'Thông báo' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line">
      {roleError && (
        <div
          role="alert"
          className="fixed top-14 right-6 z-50 px-4 py-2.5 rounded-xl bg-danger text-white text-xs font-semibold shadow-lg flex items-center gap-2"
        >
          <span>{roleError}</span>
          <button type="button" onClick={() => setRoleError(null)} className="ml-2 underline">
            Đóng
          </button>
        </div>
      )}

      {/* Top Utility Strip */}
      <div className="bg-canvas border-b border-line/60 text-[11px] text-subtle overflow-hidden">
        <div className="page-shell flex items-center justify-between h-8">
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/seller/listings" className="hover:text-ink transition-colors font-medium">
              Kênh Người Bán
            </Link>
            <span className="text-line">|</span>
            <Link href="/supplier/products" className="hover:text-ink transition-colors font-medium">
              Kênh Nhà Cung Cấp
            </Link>
            <span className="text-line">|</span>
            <span className="text-subtle/80">Hỗ trợ: 1900 8888</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-subtle/70">Tài khoản:</span>
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

      {/* Main Storefront Navbar */}
      <div className="page-shell py-3 flex items-center justify-between gap-4 sm:gap-8">
        <Link
          href="/"
          aria-label="DropConnect — Trang chủ"
          className="flex items-center gap-2.5 shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center">
            <Icon name="box" width={17} height={17} />
          </span>
          <span className="font-bold text-lg tracking-tight text-ink">
            DropConnect
          </span>
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl hidden md:flex flex-col">
          <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm, phụ kiện, nhà cung cấp..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full h-10 pl-4 pr-10 rounded-xl bg-canvas border border-line text-xs text-ink placeholder:text-subtle/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            <button
              type="submit"
              aria-label="Tìm kiếm"
              className="absolute right-1 top-1 bottom-1 w-8 h-8 rounded-lg flex items-center justify-center text-subtle hover:text-ink hover:bg-muted transition"
            >
              <Icon name="search" width={16} height={16} />
            </button>
          </form>
        </div>

        {/* Right Actions: Orders, Cart, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link
            href="/orders"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
          >
            <Icon name="receipt" width={16} height={16} />
            <span>Đơn hàng</span>
          </Link>

          <Link
            href="/cart"
            aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
            className="relative p-2 rounded-xl text-ink hover:bg-muted transition-colors"
          >
            <Icon name="bag" width={20} height={20} />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-ink text-white rounded-full min-w-4 h-4 px-1 text-[10px] font-bold flex items-center justify-center tabular">
                {cartCount}
              </span>
            )}
          </Link>

          {identity.isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-line hover:bg-muted transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-canvas text-ink border border-line flex items-center justify-center font-bold text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-ink leading-tight max-w-28 truncate">
                    {currentUser.name}
                  </div>
                </div>
                <Icon name="chevron" width={12} height={12} className="text-subtle hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-surface rounded-2xl border border-line shadow-lg p-3 z-50 space-y-2.5">
                  <div className="pb-2.5 border-b border-line">
                    <div className="text-xs font-bold text-ink truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-subtle truncate">{currentUser.email}</div>
                  </div>

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
                                ? 'bg-ink text-white font-semibold'
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

                  <div className="space-y-0.5 text-xs">
                    <Link
                      href="/orders"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                    >
                      Đơn mua của tôi
                    </Link>
                    <Link
                      href="/customer/disputes"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                    >
                      Khiếu nại & Đổi trả
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-2.5 py-1.5 rounded-lg text-subtle hover:text-ink hover:bg-muted transition"
                    >
                      Thông báo
                    </Link>
                  </div>

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
                className="text-xs font-semibold bg-ink hover:bg-ink/90 text-white px-3 py-1.5 rounded-lg transition"
              >
                Đăng ký
              </Link>
            </div>
          )}

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

      {/* Storefront Navigation Links */}
      <nav aria-label="Danh mục điều hướng chính" className="hidden lg:block border-t border-line/70">
        <div className="page-shell flex items-center gap-6 overflow-x-auto h-10 scrollbar-none">
          {storefrontLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`text-xs font-medium whitespace-nowrap transition-colors relative py-2.5 ${
                  isActive
                    ? 'text-ink font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-ink'
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
          className="lg:hidden border-t border-line bg-surface p-4 space-y-3 shadow-md"
        >
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

          <div className="flex flex-col gap-0.5 pt-1">
            {storefrontLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                  pathname === link.href
                    ? 'bg-canvas text-ink font-semibold'
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
