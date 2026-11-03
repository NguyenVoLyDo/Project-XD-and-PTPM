'use client';

import React from 'react';
import { WorkspaceShell, type WorkspaceMenuItem } from '@/components/workspace/workspace-shell';

const supplierMenuItems: WorkspaceMenuItem[] = [
  { href: '/supplier/products', label: 'Tổng quan & Kho hàng', icon: 'chart', exact: true },
  { href: '/supplier/products', label: 'Sản phẩm nguồn', icon: 'box' },
  { href: '/supplier/orders', label: 'Đơn hàng cần xử lý', icon: 'truck' },
  { href: '/supplier/market', label: 'Thị trường bán lẻ', icon: 'store' },
  { href: '/catalog', label: 'Sàn thương mại', icon: 'tag' },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell
      role="SUPPLIER"
      title="Nhà Cung Cấp"
      subtitle="Kênh vận hành nguồn hàng"
      menuItems={supplierMenuItems}
    >
      {children}
    </WorkspaceShell>
  );
}

