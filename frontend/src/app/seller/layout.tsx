'use client';

import React from 'react';
import { WorkspaceShell, SELLER_MENU_ITEMS } from '@/components/workspace/workspace-shell';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="SELLER"
      title="Người Bán"
      subtitle="Kênh quản lý gian hàng"
      menuItems={SELLER_MENU_ITEMS}
    >
      {children}
    </WorkspaceShell>
  );
}
