import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
                DC
              </div>
              <span className="font-bold text-white text-base">DropConnect</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Nền tảng Dropshipping B2B2C nội địa kết nối Nhà cung cấp, Người bán và Khách hàng với khả năng tách đơn tự động, snapshot giá và đối soát tài chính minh bạch.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Dành cho Khách hàng</h4>
            <ul className="space-y-2">
              <li><Link href="/catalog" className="hover:text-white transition">Tìm kiếm sản phẩm</Link></li>
              <li><Link href="/cart" className="hover:text-white transition">Giỏ hàng</Link></li>
              <li><Link href="/orders" className="hover:text-white transition">Theo dõi đơn hàng</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Dành cho Người bán & NCC</h4>
            <ul className="space-y-2">
              <li><Link href="/seller/listings" className="hover:text-white transition">Quản lý Listing & Biên lợi nhuận</Link></li>
              <li><Link href="/supplier/products" className="hover:text-white transition">Quản lý kho & Giá vốn NCC</Link></li>
              <li><Link href="/supplier/orders" className="hover:text-white transition">Thực hiện đơn (Fulfillment)</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Hệ thống & Báo cáo</h4>
            <ul className="space-y-2">
              <li><Link href="/admin/dashboard" className="hover:text-white transition">Bảng điều hành Admin</Link></li>
              <li><Link href="/admin/disputes" className="hover:text-white transition">Quy trình xử lý tranh chấp</Link></li>
              <li><Link href="/admin/audit-logs" className="hover:text-white transition">Lịch sử Audit Log</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500">
          <div>© 2026 DropConnect B2B2C Platform. Đồ án Xây dựng và PTPM.</div>
          <div className="mt-2 sm:mt-0 flex gap-4">
            <span>PostgreSQL</span>
            <span>NestJS Modular Monolith</span>
            <span>Next.js App Router</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
