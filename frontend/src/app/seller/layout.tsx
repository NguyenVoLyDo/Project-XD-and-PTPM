'use client';

import React from 'react';
import { WorkspaceShell, type WorkspaceMenuItem } from '@/components/workspace/workspace-shell';

const sellerMenuItems: WorkspaceMenuItem[] = [
  { href: '/seller/listings', label: 'Tổng quan & Niêm yết', icon: 'chart', exact: true },
  { href: '/seller/listings', label: 'Quản lý gian hàng', icon: 'store' },
  { href: '/seller/sourcing', label: 'Tìm kiếm nguồn hàng', icon: 'search' },
  { href: '/orders', label: 'Đơn hàng bán lẻ', icon: 'receipt' },
  { href: '/catalog', label: 'Thị trường bán lẻ', icon: 'tag' },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="SELLER"
      title="Người Bán"
      subtitle="Kênh quản lý người bán"
      menuItems={sellerMenuItems}
    >
      {children}
    </WorkspaceShell>
  );
}

