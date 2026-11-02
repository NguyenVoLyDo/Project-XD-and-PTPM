import Link from 'next/link';
import { Icon } from './ui/icon';
export function Footer() {
  return <footer className="mt-16 bg-surface border-t border-line">
    <div className="page-shell py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
      <div className="max-w-sm">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg"><Icon name="box" className="text-primary" />DropConnect</Link>
        <p className="mt-3 text-sm text-subtle leading-7">Kết nối những gian hàng và nhà cung cấp trong nước. Tìm món đồ bạn cần, mua trong một giỏ hàng, theo dõi từng kiện giao đến.</p>
      </div>
      <div><h2 className="text-sm font-semibold mb-4">Mua sắm cùng DropConnect</h2><ul className="space-y-3 text-sm text-subtle">
        <li><Link className="hover:text-primary" href="/catalog">Khám phá sản phẩm</Link></li>
        <li><Link className="hover:text-primary" href="/cart">Giỏ hàng của bạn</Link></li>
        <li><Link className="hover:text-primary" href="/orders">Theo dõi đơn hàng</Link></li>
      </ul></div>
      <div><h2 className="text-sm font-semibold mb-4">Dành cho đối tác</h2><ul className="space-y-3 text-sm text-subtle">
        <li><Link className="hover:text-primary" href="/seller/listings">Quản lý gian hàng</Link></li>
        <li><Link className="hover:text-primary" href="/supplier/products">Sản phẩm & tồn kho</Link></li>
      </ul><p className="text-xs text-subtle mt-4">Đăng nhập và chọn vai trò đã được duyệt để quản lý hoạt động của bạn.</p></div>
    </div>
    <div className="page-shell border-t border-line py-5 text-xs text-subtle flex flex-wrap justify-between gap-2"><span>© 2026 DropConnect.</span><span>Phiên bản trải nghiệm của đồ án.</span></div>
  </footer>;
}
