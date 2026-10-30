import Image from 'next/image';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/icon';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';

export interface ListingCardItem {
  id: string; productName: string; sellerShopName?: string; shopName?: string; sellerName?: string;
  supplierName?: string; supplierId?: string; productImage?: string; salePrice?: number; retailPrice?: number;
  originalPrice?: number; availableStock?: number; status?: string;
}
interface ListingCardProps {
  item: ListingCardItem; onAddToCart: (item: ListingCardItem) => void; isAdding?: boolean;
  disabled?: boolean; currency?: string; className?: string;
}
export function ListingCard({ item, onAddToCart, isAdding = false, disabled, currency = 'đ', className }: ListingCardProps) {
  const outOfStock = item.availableStock !== undefined && item.availableStock <= 0;
  const image = item.productImage?.includes('photo-1590658268037') ? '/images/earbuds.jpg'
    : item.productImage?.includes('photo-1583863788434') ? '/images/charger.jpg'
    : item.productImage?.includes('photo-1602143407151') ? '/images/bottle.jpg' : item.productImage;
  return <article className={cn('product-card bg-surface border border-line rounded-2xl overflow-hidden flex flex-col hover:border-primary/30 transition-colors', className)}>
    <div className="product-image relative">
      {image ? <Image src={image} alt={item.productName} width={640} height={480} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" unoptimized={!image.startsWith('/')} />
        : <div className="h-full grid place-items-center text-subtle"><Icon name="box" width={48} height={48} /></div>}
      {outOfStock && <span className="absolute top-3 left-3 rounded-lg px-2.5 py-1 bg-surface text-rose-700 text-xs font-semibold">Tạm hết hàng</span>}
    </div>
    <div className="p-5 flex flex-col flex-1">
      <p className="text-xs text-subtle mb-2 truncate">{item.shopName || item.sellerShopName || item.sellerName || 'Gian hàng DropConnect'}</p>
      <h3 className="font-semibold text-base leading-6 line-clamp-2 min-h-12">{item.productName}</h3>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <PriceDisplay amount={item.salePrice ?? item.retailPrice ?? 0} originalAmount={item.originalPrice} currency={currency} size="lg" />
        {!outOfStock && <span className="text-xs text-primary">Còn hàng</span>}
      </div>
      <p className="text-xs text-subtle mt-3 mb-5 line-clamp-1" title={item.supplierName}>Cung cấp bởi {item.supplierName || 'đối tác trong nước'}</p>
      <Button className="w-full mt-auto" variant="outline" onClick={() => onAddToCart(item)} disabled={disabled || outOfStock} isLoading={isAdding}>
        <Icon name="bag" width={18} height={18} /><span>{outOfStock ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</span>
      </Button>
    </div>
  </article>;
}
