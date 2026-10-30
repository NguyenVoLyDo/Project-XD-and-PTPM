'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, DEMO_ACCOUNTS } from '../lib/auth-context';
import { Icon } from './ui/icon';

export function Navbar() {
  const { currentUser, switchAccount, cartCount } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const links = currentUser.role === 'SELLER'
    ? [{ href: '/seller/listings', label: 'Quản lý gian hàng' }, { href: '/catalog', label: 'Khám phá sản phẩm' }]
    : currentUser.role === 'SUPPLIER'
      ? [{ href: '/supplier/products', label: 'Sản phẩm & tồn kho' }, { href: '/catalog', label: 'Danh mục sản phẩm' }]
      : [{ href: '/', label: 'Trang chủ' }, { href: '/catalog', label: 'Khám phá' }, { href: '/orders', label: 'Đơn hàng' }];
  const renderLinks = () => links.map(link => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
    aria-current={pathname === link.href ? 'page' : undefined}
    className={'min-h-11 flex items-center px-3 rounded-lg text-sm font-semibold transition-colors ' + (pathname === link.href ? 'bg-primary-soft text-primary' : 'text-subtle hover:bg-muted hover:text-ink')}>{link.label}</Link>);
  return <header className="sticky top-0 z-40 bg-surface border-b border-line">
    <div className="bg-primary-soft border-b border-line">
      <div className="page-shell flex items-center justify-between gap-3 py-1.5 text-xs text-primary">
        <span className="hidden sm:inline">Nhiều gian hàng. Một trải nghiệm mua sắm.</span>
        <div className="flex items-center gap-2 min-w-0 ml-auto">
          <label htmlFor="demo-account" className="whitespace-nowrap">Bản demo</label>
          <select id="demo-account" value={currentUser.id} onChange={event => {
            const account = DEMO_ACCOUNTS.find(item => item.id === event.target.value);
            if (account) switchAccount(account);
          }} className="max-w-[230px] min-h-8 text-xs bg-surface rounded-md border border-line px-2">
            {DEMO_ACCOUNTS.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
      </div>
    </div>
    <div className="page-shell flex items-center justify-between gap-4 min-h-20">
      <Link href="/" aria-label="DropConnect — Trang chủ" className="flex items-center gap-2.5 shrink-0">
        <span className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center"><Icon name="box" width={24} height={24} /></span>
        <span className="font-bold text-xl tracking-tight">Drop<span className="text-primary">Connect</span></span>
      </Link>
      <nav aria-label="Điều hướng chính" className="hidden lg:flex gap-1">{renderLinks()}</nav>
      <div className="flex items-center gap-2">
        <Link href="/catalog" aria-label="Tìm kiếm sản phẩm" className="hidden sm:flex w-11 h-11 items-center justify-center rounded-xl hover:bg-muted"><Icon name="search" /></Link>
        {currentUser.role === 'CUSTOMER' && <Link href="/cart" aria-label={'Giỏ hàng, ' + cartCount + ' sản phẩm'} className="flex items-center gap-2 min-h-11 px-3 rounded-xl border border-line hover:bg-primary-soft">
          <Icon name="bag" /><span className="hidden sm:inline text-sm font-semibold">Giỏ hàng</span><span className="bg-primary text-on-primary rounded-full min-w-5 h-5 px-1 text-xs flex items-center justify-center tabular">{cartCount}</span>
        </Link>}
        <button type="button" aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileOpen} aria-controls="mobile-navigation"
          onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl border border-line" onKeyDown={event => { if (event.key === 'Escape') setMobileOpen(false); }}>
          <Icon name={mobileOpen ? 'close' : 'menu'} />
        </button>
      </div>
    </div>
    {mobileOpen && <nav id="mobile-navigation" aria-label="Điều hướng di động" className="lg:hidden page-shell pb-4 flex flex-col gap-1" onKeyDown={event => { if (event.key === 'Escape') setMobileOpen(false); }}>{renderLinks()}</nav>}
  </header>;
}
