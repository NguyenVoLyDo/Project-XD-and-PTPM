import * as React from 'react';
import Link from 'next/link';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { StatusBadge } from '../../molecules/status-badge';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface OrderCardProps {
  orderId: string;
  orderNo: string;
  status: string;
  fulfillmentSummary: string;
  paymentMethod: string;
  paymentStatus: string;
  grandTotal: number;
  totalPayable: number;
  itemCount: number;
  fulfillmentOrderCount?: number;
  createdAt: string;
  currency?: string;
  className?: string;
}

export function OrderCard({
  orderId,
  orderNo,
  status,
  fulfillmentSummary,
  paymentMethod,
  paymentStatus,
  grandTotal,
  totalPayable,
  itemCount,
  fulfillmentOrderCount,
  createdAt,
  currency = 'đ',
  className,
}: OrderCardProps) {
  const formattedDate = React.useMemo(() => {
    try {
      return new Date(createdAt).toLocaleString('vi-VN');
    } catch {
      return createdAt;
    }
  }, [createdAt]);

  return (
    <Card
      className={cn(
        'p-5 sm:p-6 transition-[color,background-color,border-color,box-shadow] hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)] space-y-4',
        className,
      )}
    >
      {/* Top row: Order Number, Date, Status Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink text-base tracking-tight">#{orderNo}</span>
            <span className="text-xs font-mono text-subtle">({orderId.slice(0, 8)}...)</span>
          </div>
          <div className="text-xs text-subtle mt-0.5">Đặt lúc: {formattedDate}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <StatusBadge status={fulfillmentSummary} />
        </div>
      </div>

      {/* Middle info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1 text-xs">
        <div>
          <div className="text-subtle text-xs">Số lượng mặt hàng</div>
          <div className="font-bold text-ink mt-0.5">{itemCount} sản phẩm</div>
        </div>

        <div>
          <div className="text-subtle text-xs">Kiện hàng NCC</div>
          <div className="font-bold text-primary mt-0.5">
            {fulfillmentOrderCount !== undefined ? `${fulfillmentOrderCount} kiện phân tách` : 'Tách theo NCC'}
          </div>
        </div>

        <div>
          <div className="text-subtle text-xs">Hình thức thanh toán</div>
          <div className="font-semibold text-ink mt-0.5 flex items-center gap-1.5">
            <span>{paymentMethod === 'COD' ? 'Tiền mặt COD' : 'VietQR Trực tuyến'}</span>
            <Badge variant={paymentStatus === 'PAID' ? 'success' : 'warning'} className="text-[9px] py-0 px-1">
              {paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-subtle text-xs">Tổng thanh toán</div>
          <PriceDisplay amount={totalPayable || grandTotal} size="lg" currency={currency} />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-line">
        <span className="text-xs text-subtle hidden sm:inline">
          Bảo đảm bởi Dropshipping Platform
        </span>

        <Link href={`/orders/${orderId}`} className="w-full sm:w-auto">
          <Button variant="secondary" size="sm" className="w-full sm:w-auto font-semibold">
            <span>Xem chi tiết kiện hàng</span>
            <span className="text-xs">→</span>
          </Button>
        </Link>
      </div>
    </Card>
  );
}
