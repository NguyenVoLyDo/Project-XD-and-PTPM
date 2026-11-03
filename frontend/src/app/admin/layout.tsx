'use client';

import React from 'react';
import { WorkspaceShell, ADMIN_MENU_ITEMS } from '@/components/workspace/workspace-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="ADMIN"
      title="Quản Trị Viên"
      subtitle="Bảng điều khiển hệ thống"
      menuItems={ADMIN_MENU_ITEMS}
    >
      {children}
    </WorkspaceShell>
  );
}
