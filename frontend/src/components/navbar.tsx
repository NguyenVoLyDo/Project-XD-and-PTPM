'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, DEMO_ACCOUNTS } from '../lib/auth-context';

export function Navbar() {
  const { currentUser, switchAccount, cartCount } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const pathname = usePathname();

  const getNavLinks = () => {
    switch (currentUser.role) {
      case 'SELLER':
        return [
          { href: '/seller/listings', label: 'Niêm yết & Giá bán (TV2)' },
          { href: '/catalog', label: 'Xem Catalog nguồn (TV2)' },
        ];
      case 'SUPPLIER':
        return [
          { href: '/supplier/products', label: 'Sản phẩm nguồn & Tồn kho (TV2)' },
        ];
      default:
        return [
          { href: '/', label: 'Trang chủ' },
          { href: '/catalog', label: 'Catalog sản phẩm nguồn (TV2)' },
          { href: '/seller/listings', label: 'Gian hàng & Niêm yết (TV2)' },
          { href: '/supplier/products', label: 'NCC: Quản lý kho (TV2)' },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800">
      {/* Top bar for fast switching role */}
      <div className="bg-slate-950/80 px-4 py-1.5 border-b border-slate-800/60 text-xs flex flex-wrap items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Nền tảng Dropshipping B2B2C DropConnect</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Đang đóng vai: <strong className="text-white">{currentUser.name}</strong> ({currentUser.badge})</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/60 transition"
          >
            <span>Đổi vai trò mô phỏng</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-1 w-64 glass-panel rounded-lg shadow-2xl py-1.5 border border-indigo-500/30 z-50 text-slate-200">
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Chọn vai để trải nghiệm hệ thống:
              </div>
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => {
                    switchAccount(acc);
                    setRoleMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-indigo-600/20 transition ${
                    currentUser.id === acc.id ? 'bg-indigo-600/30 text-indigo-300 font-semibold' : ''
                  }`}
                >
                  <div>
                    <div>{acc.name}</div>
                    <div className="text-[10px] text-slate-400">{acc.email}</div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700">
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-500/25">
            DC
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight gradient-text">DropConnect</span>
            <span className="block text-[10px] text-slate-400 font-medium tracking-wide uppercase">B2B2C Domestic Platform</span>
          </div>
        </Link>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right action icons */}
        <div className="flex items-center gap-3">
          {currentUser.role === 'CUSTOMER' && (
            <Link
              href="/cart"
              className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 transition"
              title="Giỏ hàng"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white text-[11px] font-bold flex items-center justify-center shadow-lg shadow-pink-500/50">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <div className="font-semibold text-white">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400">{currentUser.badge}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
