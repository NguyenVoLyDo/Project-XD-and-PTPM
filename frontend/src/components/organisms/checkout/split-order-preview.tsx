import { Card } from '../../ui/card';
import { Icon } from '../../ui/icon';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';
export interface CheckoutPreviewItem {
  listingId: string; title: string; quantity: number; unitSalePrice: number; supplierId?: string; sellerId?: string; supplierName?: string;
}
export function SplitOrderPreview({ items, currency = 'đ', className }: { items: CheckoutPreviewItem[]; currency?: string; className?: string }) {
  const groups = new Map<string, CheckoutPreviewItem[]>();
  for (const item of items) {
    const key = JSON.stringify([item.supplierId ?? item.listingId, item.sellerId ?? item.listingId]);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return <Card className={cn('p-5 sm:p-7', className)}>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h2 className="text-lg font-semibold">Các kiện hàng của bạn</h2><span className="text-xs text-primary bg-primary-soft px-3 py-1.5 rounded-full">{groups.size} kiện hàng phân tách</span></div>
    <p className="text-sm text-subtle mb-5">Sản phẩm từ các nhà cung cấp hoặc người bán khác nhau được giao thành từng kiện riêng.</p>
    <div className="divide-y divide-line">{Array.from(groups.entries()).map(([key, lines], index) => <section key={key} className="py-4 first:pt-0 last:pb-0">
      <h3 className="flex gap-2 items-center text-sm font-semibold"><Icon name="box" className="text-primary shrink-0" />Kiện {index + 1} · {lines[0].supplierName || 'Nhà cung cấp'}</h3>
      <ul className="mt-3 space-y-3">{lines.map(item => <li key={item.listingId} className="flex items-start justify-between gap-4 text-sm"><span className="min-w-0 text-subtle">{item.title}<span className="block text-xs mt-1">Số lượng: {item.quantity}</span></span><span className="shrink-0"><PriceDisplay amount={item.unitSalePrice * item.quantity} currency={currency} size="sm" /></span></li>)}</ul>
    </section>)}</div>
  </Card>;
}
