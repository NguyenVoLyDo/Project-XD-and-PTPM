import Image from 'next/image';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/icon';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface ListingCardItem {
  id: string;
  productName: string;
  sellerShopName?: string;
  shopName?: string;
  sellerName?: string;
  supplierName?: string;
  supplierId?: string;
  productImage?: string;
  salePrice?: number;
  retailPrice?: number;
  originalPrice?: number;
  availableStock?: number;
  status?: string;
}

interface ListingCardProps {
  item: ListingCardItem;
  onAddToCart: (item: ListingCardItem) => void;
  isAdding?: boolean;
  disabled?: boolean;
  currency?: string;
  className?: string;
}

export function ListingCard({
  item,
  onAddToCart,
  isAdding = false,
  disabled,
  currency = 'đ',
  className,
}: ListingCardProps) {
  const outOfStock = item.availableStock !== undefined && item.availableStock <= 0;
  const defaultImage = item.productName?.toLowerCase().includes('tai nghe')
    ? '/images/earbuds.jpg'
    : item.productName?.toLowerCase().includes('bình') || item.productName?.toLowerCase().includes('lock')
    ? '/images/bottle.jpg'
    : '/images/charger.jpg';

  const image = item.productImage?.includes('photo-1590658268037')
    ? '/images/earbuds.jpg'
    : item.productImage?.includes('photo-1583863788434')
    ? '/images/charger.jpg'
    : item.productImage?.includes('photo-1602143407151')
    ? '/images/bottle.jpg'
    : item.productImage || defaultImage;

  const currentPrice = item.salePrice ?? item.retailPrice ?? 0;
  const originalPrice = item.originalPrice ?? Math.round(currentPrice * 1.18);
  const discountPercent =
    originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null;

  return (
    <article
      className={cn(
        'product-card group bg-surface border border-line rounded-2xl overflow-hidden flex flex-col hover:border-ink/30 transition-all duration-200',
        className,
      )}
    >
      {/* Product Image Area */}
      <div className="product-image relative overflow-hidden bg-canvas aspect-4/3">
        {image ? (
          <Image
            src={image}
            alt={item.productName}
            width={640}
            height={480}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={!image.startsWith('/')}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full grid place-items-center text-subtle">
            <Icon name="box" width={40} height={40} />
          </div>
        )}

        {/* Discount Badge on Image */}
        {discountPercent && discountPercent > 0 && (
          <div className="absolute top-2.5 left-2.5 pointer-events-none">
            <span className="rounded-md px-2 py-0.5 bg-ink text-white font-semibold text-[11px]">
              -{discountPercent}%
            </span>
          </div>
        )}

        {outOfStock && (
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center">
            <span className="rounded-xl px-3.5 py-1.5 bg-surface text-ink font-semibold text-xs border border-line">
              Tạm hết hàng
            </span>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Shop Name */}
        <div className="flex items-center gap-1.5 text-xs text-subtle mb-1 truncate">
          <Icon name="store" width={12} height={12} className="text-subtle shrink-0" />
          <span className="truncate">{item.shopName || item.sellerShopName || item.sellerName || 'Gian hàng DropConnect'}</span>
        </div>

        {/* Product Title */}
        <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug line-clamp-2 min-h-10">
          {item.productName}
        </h3>

        {/* Star Rating & Sold count */}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-subtle">
          <div className="flex items-center gap-1 text-ink font-medium">
            <Icon name="star" width={12} height={12} className="text-subtle" />
            <span>4.9</span>
          </div>
          <span className="text-line">•</span>
          <span>Đã bán 50+</span>
        </div>

        {/* Price Section */}
        <div className="mt-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <PriceDisplay
            amount={currentPrice}
            originalAmount={originalPrice}
            currency={currency}
            size="lg"
          />
          {!outOfStock && (
            <span className="text-[11px] font-medium text-subtle bg-canvas border border-line px-2 py-0.5 rounded-md">
              Còn hàng
            </span>
          )}
        </div>

        {/* Supplier / Warehouse info */}
        <div className="mt-2 mb-4 text-[11px] text-subtle truncate flex items-center gap-1.5" title={item.supplierName}>
          <Icon name="truck" width={12} height={12} className="text-subtle shrink-0" />
          <span className="truncate">Kho: <strong>{item.supplierName || 'Đối tác trong nước'}</strong></span>
        </div>

        {/* Action Button */}
        <Button
          className="w-full mt-auto text-xs font-semibold rounded-xl h-10"
          variant={outOfStock ? 'secondary' : 'default'}
          onClick={() => onAddToCart(item)}
          disabled={disabled || outOfStock}
          isLoading={isAdding}
        >
          <Icon name="bag" width={15} height={15} />
          <span>{outOfStock ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</span>
        </Button>
      </div>
    </article>
  );
}
