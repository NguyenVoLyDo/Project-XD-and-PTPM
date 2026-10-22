'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiClient } from '../lib/api';
import { ListingItem } from '../lib/types';
import { useAuth } from '../lib/auth-context';

export default function HomePage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const { currentUser, refreshCartCount } = useAuth();

  useEffect(() => {
    async function fetchListings() {
      try {
        const data: any = await ApiClient.get('/listings');
        if (Array.isArray(data)) {
          setListings(data);
        }
      } catch {
        // fallback sample data if backend not yet running
        setListings([
          {
            id: 'list-l1-anker',
            productId: 'prod-p1-anker',
            shopId: 'shop-x-1',
            sellerSku: 'TS-ANKER-30W',
            salePrice: 279000,
            costPrice: 180000,
            status: 'ACTIVE',
            visible: true,
            productName: 'Củ sạc nhanh Anker Nano III 30W Type-C GaN',
            productDescription: 'Sạc nhanh siêu nhỏ gọn công nghệ GaN, tương thích iPhone 15/16, Samsung S24 và iPad.',
            productImage: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
            availableStock: 50,
            shopName: 'TechStore Siêu Rẻ',
            supplierName: 'Công ty TNHH Phụ Kiện Số Việt Nam',
            sellerName: 'Nguyễn Văn Seller',
            supplierId: 'prof-supp-a',
            sellerId: 'prof-sell-x',
          },
          {
            id: 'list-l2-locknlock',
            productId: 'prod-p2-locknlock',
            shopId: 'shop-x-1',
            sellerSku: 'TS-LOCK-500ML',
            salePrice: 349000,
            costPrice: 220000,
            status: 'ACTIVE',
            visible: true,
            productName: 'Bình giữ nhiệt Lock&Lock Energetic One-Touch 500ml',
            productDescription: 'Chất liệu thép không gỉ SUS316 cao cấp, giữ nóng 8 giờ, giữ lạnh 24 giờ, nắp mở 1 chạm.',
            productImage: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
            availableStock: 35,
            shopName: 'TechStore Siêu Rẻ',
            supplierName: 'Tổng Kho Gia Dụng Thông Minh B&C',
            sellerName: 'Nguyễn Văn Seller',
            supplierId: 'prof-supp-b',
            sellerId: 'prof-sell-x',
          },
          {
            id: 'list-l3-baseus',
            productId: 'prod-p3-tainghe',
            shopId: 'shop-x-1',
            sellerSku: 'TS-BASEUS-E16',
            salePrice: 249000,
            costPrice: 160000,
            status: 'ACTIVE',
            visible: true,
            productName: 'Tai nghe Bluetooth True Wireless Baseus Bowie E16',
            productDescription: 'Âm bass mạnh mẽ, chống nước IPX4, thời lượng pin lên đến 30 giờ kèm dock sạc.',
            productImage: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
            availableStock: 40,
            shopName: 'TechStore Siêu Rẻ',
            supplierName: 'Công ty TNHH Phụ Kiện Số Việt Nam',
            sellerName: 'Nguyễn Văn Seller',
            supplierId: 'prof-supp-a',
            sellerId: 'prof-sell-x',
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchListings();
  }, []);

  const handleAddToCart = async (listingId: string, title: string) => {
    setAddingId(listingId);
    try {
      await ApiClient.post('/cart/items', { listingId, quantity: 1 });
      await refreshCartCount();
      setAddedMessage(`Đã thêm "${title}" vào giỏ hàng!`);
      setTimeout(() => setAddedMessage(null), 3000);
    } catch {
      setAddedMessage(`Đã thêm "${title}" vào giỏ hàng (chế độ demo)!`);
      setTimeout(() => setAddedMessage(null), 3000);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-12">
      {/* Toast Alert */}
      {addedMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{addedMessage}</span>
          <Link href="/cart" className="underline text-emerald-100 text-xs ml-2 hover:text-white">
            Xem giỏ hàng →
          </Link>
        </div>
      )}

      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-slate-800">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
            Mô hình Dropshipping B2B2C Nội Địa
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
            Kết nối <span className="gradient-text">Nguồn hàng, Người bán</span> và Khách mua sắm
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
            Nền tảng thương mại tự động hóa quy trình Dropshipping: Khách mua một giỏ hàng đa nguồn, hệ thống tự động tách đơn con theo từng Nhà cung cấp, giữ tồn kho thời gian thực và tự đối soát lợi nhuận.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/catalog"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 hover:opacity-95 transition"
            >
              Khám phá sản phẩm →
            </Link>
            <Link
              href="/seller/listings"
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition"
            >
              Cổng Người bán (Seller)
            </Link>
            <Link
              href="/supplier/products"
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition"
            >
              Cổng Nhà cung cấp (Supplier)
            </Link>
          </div>
        </div>

        {/* 3 Pillars Flow Diagram */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-indigo-400 font-bold mb-1">1. Nhà cung cấp (Supplier)</div>
            <p className="text-xs text-slate-400">Đăng sản phẩm nguồn, cập nhật giá vốn & tồn kho thực tế, nhận đơn đóng gói và bàn giao hãng vận chuyển.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-purple-400 font-bold mb-1">2. Người bán (Seller)</div>
            <p className="text-xs text-slate-400">Mở gian hàng, kéo sản phẩm nguồn tạo Listing, tự đặt giá bán hưởng chênh lệch mà không cần vốn ôm hàng.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-pink-400 font-bold mb-1">3. Khách hàng (Customer)</div>
            <p className="text-xs text-slate-400">Mua sắm một lần nhiều món từ các kho khác nhau, thanh toán COD hoặc Online, theo dõi tracking chi tiết.</p>
          </div>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Sản phẩm niêm yết nổi bật</h2>
            <p className="text-xs text-slate-400 mt-1">Các sản phẩm đang hoạt động trên các gian hàng Dropship</p>
          </div>
          <Link href="/catalog" className="text-xs text-indigo-400 font-semibold hover:text-indigo-300">
            Xem tất cả ({listings.length}) →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(item => (
              <div
                key={item.id}
                className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between border border-slate-800"
              >
                <div>
                  {/* Product Image */}
                  <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
                      Tồn kho: {item.availableStock}
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/30">
                      {item.shopName}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 space-y-3">
                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                      <span>NCC: {item.supplierName}</span>
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug line-clamp-2">
                      {item.productName}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.productDescription}
                    </p>
                  </div>
                </div>

                {/* Footer price & action */}
                <div className="p-5 pt-0 border-t border-slate-800/60 mt-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Giá bán lẻ</div>
                    <div className="text-xl font-extrabold text-pink-400">
                      {item.salePrice.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-400">đ</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddToCart(item.id, item.productName)}
                    disabled={addingId === item.id || item.availableStock === 0}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      item.availableStock === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>{addingId === item.id ? 'Đang thêm...' : 'Thêm giỏ'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Core Architectural Guarantees */}
      <section className="glass-panel p-8 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4">Cam kết quy tắc nghiệp vụ DropConnect (UML Verified)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="font-bold text-indigo-400 text-sm mb-1">Tách đơn nguyên tử</div>
            <p className="text-slate-400">1 giỏ hàng nhiều NCC tự động phân rã thành $N$ đơn thực hiện độc lập, không xáo trộn vận chuyển.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="font-bold text-emerald-400 text-sm mb-1">Giữ tồn kho an toàn</div>
            <p className="text-slate-400">Tồn kho được giữ (HELD) ngay khi checkout, chống race condition bán âm kho khi nhiều khách mua đồng thời.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="font-bold text-purple-400 text-sm mb-1">Bảo vệ biên lợi nhuận</div>
            <p className="text-slate-400">Nếu NCC tăng giá vốn, hệ thống tự động tạm ẩn Listing nếu vi phạm biên lợi nhuận 10% để Seller không bị lỗ.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="font-bold text-pink-400 text-sm mb-1">Sổ cái kế toán kép</div>
            <p className="text-slate-400">Tiền hàng gốc trả NCC, lãi chia Seller và phí sàn được đối soát minh bạch sau khi hoàn tất giao hàng.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
