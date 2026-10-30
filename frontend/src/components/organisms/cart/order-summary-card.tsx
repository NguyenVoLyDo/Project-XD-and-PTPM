import Link from 'next/link';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/icon';
import { PriceDisplay } from '../../molecules/price-display';
import { cn } from '../../../lib/utils';
interface OrderSummaryCardProps {
  totalItems: number; subtotal: number; shippingFee?: number; currency?: string; hasUnavailableItems?: boolean;
  onCheckout?: () => void; checkoutHref?: string; isLoading?: boolean; className?: string;
}
export function OrderSummaryCard({ totalItems, subtotal, shippingFee = 0, currency = 'đ', hasUnavailableItems = false, onCheckout, checkoutHref = '/checkout', isLoading = false, className }: OrderSummaryCardProps) {
  const disabled = totalItems === 0 || hasUnavailableItems || isLoading;
  return <Card className={cn('p-6 space-y-6 lg:sticky lg:top-36 self-start', className)}>
    <h2 className="text-lg font-semibold">Thông tin đơn hàng</h2>
    <dl className="space-y-4 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-subtle">Tạm tính ({totalItems} sản phẩm)</dt><dd><PriceDisplay amount={subtotal} size="md" currency={currency} /></dd></div>
      <div className="flex justify-between gap-3"><dt className="text-subtle">Phí giao hàng</dt><dd><PriceDisplay amount={shippingFee} size="md" currency={currency} /></dd></div>
      <div className="flex flex-wrap justify-between items-center gap-3 pt-5 border-t border-line"><dt className="font-semibold">Tổng thanh toán</dt><dd><PriceDisplay amount={subtotal + shippingFee} size="xl" currency={currency} /></dd></div>
    </dl>
    {hasUnavailableItems && <p role="alert" className="p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">Có sản phẩm không còn khả dụng. Vui lòng cập nhật giỏ hàng trước khi đặt.</p>}
    {onCheckout ? <Button size="lg" className="w-full" onClick={onCheckout} disabled={disabled} isLoading={isLoading}>
      <span>{isLoading ? 'Đang tạo đơn…' : 'Tiến hành đặt hàng'}</span><Icon name="arrow" width={18} height={18} />
    </Button> : disabled ? <Button size="lg" className="w-full" disabled>Tiếp tục thanh toán</Button>
      : <Link href={checkoutHref} className="button-link w-full">Tiếp tục thanh toán<Icon name="arrow" width={18} height={18} /></Link>}
    <p className="text-xs leading-6 text-subtle flex items-start gap-2"><Icon name="check" className="shrink-0 mt-1 text-primary" width={16} height={16} />Giá và tồn kho được kiểm tra lại khi đặt hàng. Bạn có thể theo dõi từng kiện trong chi tiết đơn.</p>
  </Card>;
}
