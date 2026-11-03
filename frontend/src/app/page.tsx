import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Icon } from '../components/ui/icon';
import { ProductBrowser } from '../components/storefront/product-browser';

export default function HomePage() {
  const categories = [
    { title: 'Tai nghe & Âm thanh', query: 'tai nghe', icon: 'headphones' as const, desc: 'True Wireless, chống ồn' },
    { title: 'Củ sạc & Năng lượng', query: 'sac', icon: 'zap' as const, desc: 'GaN 30W-65W, sạc nhanh' },
    { title: 'Bình giữ nhiệt & Đời sống', query: 'binh', icon: 'cup' as const, desc: 'Inox 316, giữ nhiệt 24h' },
    { title: 'Tất cả phụ kiện', query: '', icon: 'box' as const, desc: 'Tuyển chọn từ đối tác' },
  ];

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Banner Section - Clean, Elegant & Minimalist */}
      <section className="grid lg:grid-cols-[1.1fr_0.9fr] rounded-3xl overflow-hidden bg-surface border border-line">
        <div className="px-6 py-10 sm:p-12 lg:py-16 flex flex-col justify-center items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-canvas border border-line text-primary text-xs font-semibold mb-6">
            <Icon name="shield" width={13} height={13} />
            <span>Nền tảng Dropshipping B2B2C Nội Địa</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink tracking-tight leading-[1.15]">
            Nhiều gian hàng.<br />
            <span className="text-primary">Một giỏ hàng duy nhất.</span>
          </h1>

          <p className="text-subtle text-sm sm:text-base leading-relaxed mt-4 max-w-lg">
            Khám phá hàng trăm sản phẩm phụ kiện công nghệ và đời sống được phân tách kiện tự động và giao trực tiếp từ các Nhà cung cấp uy tín trong nước.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link href="/catalog" className="button-link shadow-xs">
              <span>Khám phá sản phẩm</span>
              <Icon name="arrow" width={16} height={16} />
            </Link>
            <Link href="/seller/listings" className="button-link button-link-secondary">
              <Icon name="store" width={16} height={16} />
              <span>Dành cho Người bán</span>
            </Link>
          </div>

          {/* Quick trust metrics */}
          <div className="flex flex-wrap items-center gap-6 mt-10 pt-6 border-t border-line text-xs text-subtle">
            <div className="flex items-center gap-1.5">
              <Icon name="check" width={14} height={14} className="text-accent" />
              <span>Nguồn hàng xác minh</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="check" width={14} height={14} className="text-accent" />
              <span>Tách kiện theo kho NCC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="check" width={14} height={14} className="text-accent" />
              <span>Thanh toán COD & VietQR</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Card */}
        <div className="relative min-h-72 sm:min-h-96 lg:min-h-[460px] bg-canvas overflow-hidden">
          <Image
            src="/images/earbuds.jpg"
            alt="Tai nghe không dây hiện đại trên bàn làm việc"
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8 bg-surface/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-line shadow-lg flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                Sản phẩm nổi bật
              </span>
              <h2 className="text-sm sm:text-base font-bold text-ink mt-0.5">
                Tai Nghe True Wireless Chống Ồn
              </h2>
              <p className="text-xs text-subtle mt-0.5">Kho: Phụ Kiện Việt • Bảo hành 12 tháng</p>
            </div>
            <Link
              href="/catalog?q=tai%20nghe"
              aria-label="Khám phá tai nghe"
              className="w-10 h-10 shrink-0 bg-primary text-on-primary rounded-xl flex items-center justify-center hover:bg-primary-hover transition"
            >
              <Icon name="arrow" width={16} height={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Category Strip - Clean Monochrome Icons */}
      <section aria-label="Danh mục ngành hàng nổi bật">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Danh mục nổi bật
            </h2>
            <p className="text-xs text-subtle mt-0.5">Chọn ngành hàng bạn đang tìm kiếm</p>
          </div>
          <Link href="/catalog" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <span>Xem tất cả</span>
            <Icon name="arrow" width={13} height={13} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              href={`/catalog${cat.query ? `?q=${encodeURIComponent(cat.query)}` : ''}`}
              className="p-5 rounded-2xl bg-surface border border-line hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between group"
            >
              <div className="w-10 h-10 rounded-xl bg-canvas border border-line text-ink flex items-center justify-center mb-3 group-hover:bg-primary-soft group-hover:text-primary group-hover:border-primary/20 transition-colors">
                <Icon name={cat.icon} width={20} height={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors">
                  {cat.title}
                </h3>
                <p className="text-xs text-subtle mt-1">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Core Advantages Bar - Minimalist Three-column */}
      <section aria-label="Lợi ích trải nghiệm" className="grid sm:grid-cols-3 gap-6 p-6 rounded-3xl bg-surface border border-line">
        {[
          {
            icon: 'bag' as const,
            title: 'Một giỏ hàng, đa gian hàng',
            text: 'Tự do chọn mua phụ kiện từ nhiều người bán khác nhau mà chỉ cần thanh toán một lần duy nhất.',
          },
          {
            icon: 'box' as const,
            title: 'Theo dõi từng kiện hàng',
            text: 'Hệ thống tự động điều phối và tách vận đơn theo từng Nhà cung cấp để giao hàng nhanh chóng.',
          },
          {
            icon: 'shield' as const,
            title: 'Chính sách giá minh bạch',
            text: 'Giá bán và số lượng tồn kho được xác thực tự động, rõ ràng thông tin trước khi đặt mua.',
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3.5 items-start">
            <span className="w-9 h-9 rounded-xl bg-canvas border border-line text-primary flex items-center justify-center shrink-0">
              <Icon name={item.icon} width={18} height={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="text-xs text-subtle mt-1 leading-relaxed">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Featured Products Section */}
      <section aria-labelledby="home-products">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-primary font-semibold uppercase tracking-wider mb-1">
              <Icon name="tag" width={13} height={13} />
              <span>Gợi ý hôm nay</span>
            </div>
            <h2 id="home-products" className="section-title">
              Sản phẩm đang được yêu thích
            </h2>
            <p className="text-subtle text-xs sm:text-sm mt-0.5">
              Các mặt hàng chất lượng cao đang sẵn sàng trong kho đối tác.
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-primary text-xs sm:text-sm font-semibold flex items-center gap-1.5 min-h-10 hover:underline"
          >
            <span>Khám phá toàn bộ Catalog</span>
            <Icon name="arrow" width={15} height={15} />
          </Link>
        </div>

        <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-3xl" />}>
          <ProductBrowser featured />
        </Suspense>
      </section>

      {/* Partner Onboarding Strip - Clean & Subtle */}
      <section className="rounded-3xl bg-surface p-8 sm:p-12 border border-line flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        <div className="max-w-xl">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-2">
            Hợp tác phát triển kinh doanh
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Bạn muốn kinh doanh hay cung ứng hàng hóa?
          </h2>
          <p className="mt-3 text-xs sm:text-sm leading-relaxed text-subtle">
            DropConnect cung cấp nền tảng quản lý niêm yết, định giá tự động theo chính sách Margin và điều phối đơn hàng trực tiếp tới Nhà cung cấp mà không cần ôm hàng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link href="/seller/listings" className="button-link shadow-xs">
            <Icon name="store" width={16} height={16} />
            <span>Kênh Người Bán</span>
          </Link>
          <Link href="/supplier/products" className="button-link button-link-secondary">
            <Icon name="box" width={16} height={16} />
            <span>Kênh Nhà Cung Cấp</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
