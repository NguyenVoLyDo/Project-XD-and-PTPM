'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '../navbar';
import { Footer } from '../footer';

/**
 * AppShell separates the public e-commerce Storefront from role-based SaaS Workspaces.
 * - Storefront (Customer & Public): Wrapped with Navbar, PageShell container, and Footer.
 * - Workspace (Seller, Supplier, Admin): Rendered full-screen with dedicated Sidebar & Topbar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isWorkspace =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/supplier');

  if (isWorkspace) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="page-shell flex-1 py-8 sm:py-10 min-w-0">
        {children}
      </main>
      <Footer />
    </>
  );
}

