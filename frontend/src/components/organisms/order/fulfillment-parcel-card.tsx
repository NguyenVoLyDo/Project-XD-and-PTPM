import * as React from 'react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { StatusBadge } from '../../molecules/status-badge';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface FulfillmentItemSnapshot {
  orderItemId?: string;
  listingId?: string;
  productName: string;
  quantity: number;
  unitSalePrice: number;
}

export interface FulfillmentParcelProps {
  index: number;
  fulfillmentOrderId: string;
  supplierId: string;
  status: string;
  amountToCollect: number;
  items: FulfillmentItemSnapshot[];
  trackingNo?: string;
  carrierCode?: string;
  currency?: string;
  className?: string;
}

export function FulfillmentParcelCard({
  index,
  fulfillmentOrderId,
  supplierId,
  status,
  amountToCollect,
  items = [],
  trackingNo,
  carrierCode,
  currency = 'đ',
  className,
}: FulfillmentParcelProps) {
  return (
    <Card className={cn('p-5 space-y-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-line', className)}>
      {/* Parcel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold text-xs border border-primary/25">
            #{index}
          </div>
          <div>
            <div className="font-bold text-ink text-sm flex items-center gap-2">
              <span>Kiện hàng từ NCC:</span>
              <span className="text-primary font-mono">{supplierId}</span>
            </div>
            <div className="text-xs text-subtle font-mono">
              Mã kiện: {fulfillmentOrderId.slice(0, 8)}...
            </div>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Logistics & Carrier Tracking */}
      {(trackingNo || carrierCode) && (
        <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-subtle">
            <svg aria-hidden="true" className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            <span>Vận chuyển: <strong className="text-ink">{carrierCode || 'GHN Express'}</strong></span>
          </div>
          {trackingNo && (
            <div className="font-mono text-primary font-semibold text-xs">
              Mã vận đơn: {trackingNo}
            </div>
          )}
        </div>
      )}

      {/* Items in this parcel */}
      <div className="space-y-2">
        {items.map((item, itemIdx) => {
          const lineTotal = item.unitSalePrice * item.quantity;
          return (
            <div
              key={item.orderItemId || itemIdx}
              className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink truncate">{item.productName}</div>
                <div className="text-xs text-subtle mt-0.5">
                  Số lượng: <strong className="text-ink">x{item.quantity}</strong> | Đơn giá: {item.unitSalePrice.toLocaleString('vi-VN')} {currency}
                </div>
              </div>
              <PriceDisplay amount={lineTotal} size="sm" currency={currency} />
            </div>
          );
        })}
      </div>

      {/* Parcel Footer / Subtotal */}
      <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
        <span className="text-subtle">Thu tiền COD kiện hàng này:</span>
        <PriceDisplay amount={amountToCollect} size="md" currency={currency} />
      </div>
    </Card>
  );
}
