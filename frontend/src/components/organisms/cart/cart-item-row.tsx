import Image from 'next/image';
import { productImage } from '../../../lib/product-image';
import * as React from 'react';
import Link from 'next/link';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { QuantityStepper } from '../../molecules/quantity-stepper';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface CartItemProps {
  listingId: string;
  image?: string;
  title: string;
  unitSalePrice: number;
  quantity: number;
  currency?: string;
  availability?: 'AVAILABLE' | 'UNAVAILABLE';
  isUpdating?: boolean;
  onUpdateQuantity: (listingId: string, newQty: number) => void;
  onRemove: (listingId: string) => void;
  className?: string;
}

export function CartItemRow({
  listingId,
  image,
  title,
  unitSalePrice,
  quantity,
  currency = 'đ',
  availability = 'AVAILABLE',
  isUpdating = false,
  onUpdateQuantity,
  onRemove,
  className,
}: CartItemProps) {
  const isUnavailable = availability === 'UNAVAILABLE';
  const lineTotal = unitSalePrice * quantity;

  return (
    <Card
      className={cn(
        'p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]',
        isUnavailable
          ? 'border-rose-500/40 bg-rose-950/10'
          : 'hover:border-line',
        className,
      )}
    >
      {/* Left: Product Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-16 h-16 rounded-xl bg-canvas border border-line flex items-center justify-center shrink-0 overflow-hidden text-primary shadow-inner">
          {image ? <Image src={productImage(image)!} alt="" width={80} height={80} unoptimized={!productImage(image)!.startsWith('/')} className="w-full h-full object-cover" /> : <span aria-hidden="true">—</span>}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-ink text-sm sm:text-base line-clamp-2">{title}</h4>
            {isUnavailable && (
              <Badge variant="destructive" className="text-xs py-0 px-2">
                Hết hàng / Tạm dừng
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <PriceDisplay amount={unitSalePrice} size="sm" currency={currency} />
          </div>
        </div>
      </div>

      {/* Right: Quantity, Subtotal, Delete */}
      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-line">
        {/* Quantity Stepper */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-subtle mb-1 sm:hidden">Số lượng:</span>
          <QuantityStepper
            value={quantity}
            min={1}
            max={99}
            onChange={(newQty) => onUpdateQuantity(listingId, newQty)}
            disabled={isUpdating || isUnavailable}
          />
        </div>

        {/* Line Total */}
        <div className="text-right min-w-[100px]">
          <div className="text-xs text-subtle ">Thành tiền</div>
          <PriceDisplay amount={lineTotal} size="md" currency={currency} />
        </div>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(listingId)}
          disabled={isUpdating}
          className="text-subtle hover:text-rose-700 hover:bg-rose-500/10 p-2 h-11 w-11 rounded-xl"
          aria-label="Xóa sản phẩm"
          title="Xóa khỏi giỏ"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </Button>
      </div>
    </Card>
  );
}
