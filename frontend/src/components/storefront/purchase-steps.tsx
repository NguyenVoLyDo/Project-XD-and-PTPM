import Link from 'next/link';
export function PurchaseSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ label: 'Giỏ hàng', href: '/cart' }, { label: 'Thanh toán', href: '/checkout' }, { label: 'Đơn hàng', href: '/orders' }];
  return <nav aria-label="Tiến trình mua hàng" className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
    {steps.map((step, index) => <span key={step.href} className="flex items-center gap-3">
      {index > 0 && <span className="w-5 sm:w-10 h-px bg-line" aria-hidden="true" />}
      <Link href={step.href} aria-current={current === index + 1 ? 'step' : undefined} className={'flex items-center gap-2 min-h-10 ' + (current === index + 1 ? 'text-primary font-semibold' : 'text-subtle')}>
        <span className={'rounded-full w-6 h-6 flex items-center justify-center text-xs ' + (current === index + 1 ? 'bg-primary text-on-primary' : 'bg-muted')}>{index + 1}</span>{step.label}
      </Link>
    </span>)}
  </nav>;
}
