import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Icon } from '../components/ui/icon';
import { ProductBrowser } from '../components/storefront/product-browser';

export default function HomePage() {
  return <div className="space-y-12 sm:space-y-16">
    <section className="grid lg:grid-cols-[1fr_1.05fr] rounded-3xl overflow-hidden bg-primary-soft">
      <div className="px-7 py-10 sm:p-12 lg:py-16 flex flex-col justify-center items-start">
        <span className="inline-flex items-center gap-2 text-primary text-sm mb-7"><span className="h-2 w-2 rounded-full bg-primary" />Mua sắm cùng DropConnect</span>
        <h1 className="text-[2.5rem] sm:text-5xl xl:text-[3.5rem] font-bold leading-[1.15] max-w-lg">Những món nhỏ.<br />Tiện ích mỗi ngày.</h1>
        <p className="text-subtle text-base leading-7 mt-6 max-w-md">Từ góc làm việc đến những chuyến đi. Khám phá phụ kiện công nghệ và đồ dùng thiết thực, trong một giỏ hàng.</p>
        <Link href="/catalog" className="button-link mt-8">Khám phá sản phẩm<Icon name="arrow" width={18} height={18} /></Link>
        <p className="text-sm text-primary mt-6 flex gap-2 items-center"><Icon name="box" width={17} height={17} />Giao từ nhà cung cấp đến bạn</p>
      </div>
      <div className="relative min-h-72 sm:min-h-96 lg:min-h-[510px] bg-[#d6d9e2]">
        <Image src="/images/earbuds.jpg" alt="Tai nghe không dây trên bàn làm việc" fill preload sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8 bg-white/95 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div><p className="text-xs text-subtle mb-1">Cho nhịp sống của bạn</p><h2 className="text-base font-semibold">Gọn nhẹ. Luôn bên mình.</h2></div>
          <Link href="/catalog?q=tai%20nghe" aria-label="Khám phá tai nghe" className="w-11 h-11 shrink-0 bg-primary-soft text-primary rounded-full flex items-center justify-center hover:bg-lime-soft"><Icon name="arrow" /></Link>
        </div>
      </div>
    </section>
    <section aria-label="Trải nghiệm mua sắm" className="grid sm:grid-cols-3 gap-6 border-b border-line pb-8">
      {[
        { icon: 'bag' as const, title: 'Một giỏ hàng, nhiều lựa chọn', text: 'Mua sản phẩm từ các gian hàng cùng lúc.' },
        { icon: 'box' as const, title: 'Theo dõi từng kiện hàng', text: 'Biết sản phẩm được giao từ nhà cung cấp nào.' },
        { icon: 'check' as const, title: 'Kiểm tra trước khi đặt', text: 'Giá và số lượng được xác nhận ở bước thanh toán.' },
      ].map(item => <div key={item.title} className="flex gap-4"><span className="text-primary pt-1"><Icon name={item.icon} width={25} height={25} /></span><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="text-sm text-subtle mt-1 leading-6">{item.text}</p></div></div>)}
    </section>
    <section aria-labelledby="home-products">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><h2 id="home-products" className="section-title">Gợi ý cho ngày của bạn</h2><p className="text-subtle text-sm mt-2">Những sản phẩm đang có trên DropConnect.</p></div><Link href="/catalog" className="text-primary text-sm font-semibold flex items-center gap-2 min-h-11 hover:underline">Xem tất cả<Icon name="arrow" width={17} height={17} /></Link></div>
      <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-2xl" />}><ProductBrowser featured /></Suspense>
    </section>
    <section className="rounded-2xl bg-lime-soft p-7 sm:p-10 flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
      <div><h2 className="text-2xl font-semibold tracking-tight">Mỗi gian hàng, thêm một kết nối.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-subtle">Bạn là người bán hoặc nhà cung cấp? Khám phá không gian quản lý sản phẩm, giá bán và tồn kho dành cho đối tác.</p></div>
      <Link href="/seller/listings" className="button-link button-link-secondary shrink-0">Khám phá gian hàng<Icon name="arrow" width={17} height={17} /></Link>
    </section>
  </div>;
}
