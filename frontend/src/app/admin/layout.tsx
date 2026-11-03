'use client';

import React from 'react';
import { WorkspaceShell, type WorkspaceMenuItem } from '@/components/workspace/workspace-shell';

const adminMenuItems: WorkspaceMenuItem[] = [
  { href: '/admin', label: 'Tổng quan hệ thống', icon: 'chart', exact: true },
  { href: '/admin/users', label: 'Quản lý người dùng', icon: 'users' },
  { href: '/admin/profiles', label: 'Xét duyệt hồ sơ KYC', icon: 'clipboard' },
  { href: '/orders', label: 'Theo dõi đơn hàng', icon: 'receipt' },
  { href: '/admin/audit', label: 'Nhật ký kiểm toán', icon: 'shield' },
  { href: '/catalog', label: 'Sàn thương mại', icon: 'box' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="ADMIN"
      title="Quản Trị Viên"
      subtitle="Bảng điều khiển hệ thống"
      menuItems={adminMenuItems}
    >
      {children}
    </WorkspaceShell>
  );
}
