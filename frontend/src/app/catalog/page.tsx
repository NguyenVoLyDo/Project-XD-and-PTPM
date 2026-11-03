import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductBrowser } from '../../components/storefront/product-browser';
import { Icon } from '../../components/ui/icon';

export const metadata: Metadata = { title: 'Khám phá sản phẩm | DropConnect' };

export default function CatalogPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-xs text-subtle">
        <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
          <Icon name="store" width={13} height={13} />
          <span>Trang chủ</span>
        </Link>
        <span aria-hidden="true" className="text-line">/</span>
        <span className="text-ink font-semibold">Khám phá sản phẩm</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-2">
            <Icon name="tag" width={12} height={12} />
            <span>Thị Trường Phụ Kiện & Đời Sống</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Khám phá nguồn sản phẩm tuyển chọn
          </h1>
          <p className="text-subtle mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
            Hàng trăm sản phẩm chính hãng từ các Nhà cung cấp uy tín trong nước, sẵn sàng giao nhanh và đảm bảo chất lượng.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-subtle bg-surface px-4 py-2.5 rounded-xl border border-line shrink-0">
          <div className="flex items-center gap-1.5">
            <Icon name="check" width={14} height={14} className="text-accent" />
            <span>Kho nội địa</span>
          </div>
          <span className="text-line">•</span>
          <div className="flex items-center gap-1.5">
            <Icon name="check" width={14} height={14} className="text-accent" />
            <span>Đổi trả 7 ngày</span>
          </div>
        </div>
      </div>

      {/* Product Browser */}
      <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-3xl" />}>
        <ProductBrowser />
      </Suspense>
    </div>
  );
}
