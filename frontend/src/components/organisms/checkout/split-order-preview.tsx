import { Card } from '../../ui/card';
import { Icon } from '../../ui/icon';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface CheckoutPreviewItem {
  listingId: string;
  title: string;
  quantity: number;
  unitSalePrice: number;
  supplierId?: string;
  sellerId?: string;
  supplierName?: string;
}

export function SplitOrderPreview({
  items,
  currency = 'đ',
  className,
}: {
  items: CheckoutPreviewItem[];
  currency?: string;
  className?: string;
}) {
  const groups = new Map<string, CheckoutPreviewItem[]>();
  for (const item of items) {
    const key = JSON.stringify([item.supplierId ?? item.listingId, item.sellerId ?? item.listingId]);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return (
    <Card className={cn('p-5 sm:p-7', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-base font-bold text-ink">Các kiện hàng của bạn</h2>
        <span className="text-xs font-semibold text-accent bg-accent-soft px-3 py-1.5 rounded-full border border-accent/20">
          {groups.size} kiện hàng phân tách
        </span>
      </div>
      <p className="text-sm text-subtle mb-5 leading-relaxed">
        Sản phẩm từ các nhà cung cấp khác nhau được giao thành từng kiện riêng.
      </p>

      {/* Parcel groups */}
      <div className="divide-y divide-line">
        {Array.from(groups.entries()).map(([key, lines], index) => (
          <section key={key} className="py-4 first:pt-0 last:pb-0">
            <h3 className="flex items-center gap-2.5 text-sm font-semibold text-ink mb-3">
              <span className="w-6 h-6 rounded-lg bg-accent-soft text-accent flex items-center justify-center text-xs font-bold border border-accent/20">
                {index + 1}
              </span>
              <Icon name="box" className="text-accent shrink-0" width={14} height={14} />
              {lines[0].supplierName || 'Nhà cung cấp'}
            </h3>
            <ul className="space-y-2.5">
              {lines.map((item) => (
                <li
                  key={item.listingId}
                  className="flex items-start justify-between gap-4 text-sm p-3 rounded-xl bg-canvas border border-line"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-ink font-medium block">{item.title}</span>
                    <span className="text-xs text-subtle mt-0.5 block">Số lượng: {item.quantity}</span>
                  </div>
                  <PriceDisplay amount={item.unitSalePrice * item.quantity} currency={currency} size="sm" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

