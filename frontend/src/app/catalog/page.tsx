import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductBrowser } from '../../components/storefront/product-browser';
export const metadata: Metadata = { title: 'Khám phá sản phẩm' };
export default function CatalogPage() {
  return <div className="space-y-7">
    <nav aria-label="Đường dẫn" className="flex gap-2 text-xs text-subtle"><Link href="/" className="hover:text-primary">Trang chủ</Link><span aria-hidden="true">/</span><span>Khám phá</span></nav>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl sm:text-4xl font-bold">Tìm món đồ hợp với bạn.</h1><p className="text-subtle mt-3 text-sm sm:text-base">Phụ kiện công nghệ và đồ dùng hằng ngày từ các gian hàng trong nước.</p></div></div>
    <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-2xl" />}><ProductBrowser /></Suspense>
  </div>;
}
