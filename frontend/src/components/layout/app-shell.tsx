'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '../navbar';
import { Footer } from '../footer';
import { WorkspaceShell } from '../workspace/workspace-shell';
import { useAuth as useIdentity } from '@/features/auth/hooks/use-auth';
import { useAuth as useDemoAuth } from '@/lib/auth-context';

const ROLE_HOME: Record<'ADMIN' | 'SELLER' | 'SUPPLIER', string> = {
  ADMIN: '/admin',
  SELLER: '/seller/listings',
  SUPPLIER: '/supplier/products',
};

/**
 * AppShell guarantees a single unified interface per Actor:
 * - CUSTOMER (and unauthenticated guests): Storefront interface (Navbar + Main + Footer)
 * - ADMIN, SELLER, SUPPLIER: Dedicated WorkspaceShell (Sidebar + Topbar) across all their routes,
 *   and automatic redirection away from Customer-only storefront routes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { actor } = useIdentity();
  const { currentUser } = useDemoAuth();

  const activeRole = actor?.activeRole || currentUser?.role;
  const isWorkspaceRole =
    activeRole === 'ADMIN' || activeRole === 'SELLER' || activeRole === 'SUPPLIER';

  const isDedicatedWorkspaceRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/supplier');

  const isPublicAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth');

  const isSharedWorkspaceRoute =
    pathname.startsWith('/customer/disputes') || pathname.startsWith('/notifications');

  // If ADMIN, SELLER, or SUPPLIER lands on a Customer storefront page (/, /catalog, /cart, /checkout, /orders),
  // redirect them to their own Workspace home so they never see a Customer Storefront interface.
  const shouldRedirectToWorkspace =
    isWorkspaceRole &&
    !isDedicatedWorkspaceRoute &&
    !isSharedWorkspaceRoute &&
    !isPublicAuthRoute;

  useEffect(() => {
    if (shouldRedirectToWorkspace && isWorkspaceRole) {
      router.replace(ROLE_HOME[activeRole]);
    }
  }, [shouldRedirectToWorkspace, isWorkspaceRole, activeRole, router]);

  // Routes under /admin, /seller, /supplier already render WorkspaceShell in their route layout.tsx
  if (isDedicatedWorkspaceRoute) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // Keep ADMIN, SELLER, SUPPLIER in their single unified WorkspaceShell on shared routes (/customer/disputes, /notifications)
  if (!isPublicAuthRoute && isWorkspaceRole) {
    if (shouldRedirectToWorkspace) {
      return (
        <WorkspaceShell role={activeRole}>
          <div className="py-16 text-center text-xs text-subtle">
            Đang chuyển tới không gian làm việc...
          </div>
        </WorkspaceShell>
      );
    }
    return <WorkspaceShell role={activeRole}>{children}</WorkspaceShell>;
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
