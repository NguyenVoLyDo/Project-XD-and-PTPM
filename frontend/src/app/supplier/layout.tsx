'use client';

import React from 'react';
import { WorkspaceShell, SUPPLIER_MENU_ITEMS } from '@/components/workspace/workspace-shell';

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="SUPPLIER"
      title="Nhà Cung Cấp"
      subtitle="Kênh vận hành kho nguồn"
      menuItems={SUPPLIER_MENU_ITEMS}
    >
      {children}
    </WorkspaceShell>
  );
}
