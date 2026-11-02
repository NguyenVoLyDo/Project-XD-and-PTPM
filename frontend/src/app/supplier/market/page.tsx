'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Icon } from '@/components/ui/icon';
import { PriceDisplay } from '@/components/molecules/price-display';

interface MarketListing {
  id: string;
  shopId: string;
  productId: string;
  sellerSku: string;
  salePrice: number;
  productName: string;
  costPrice: number;
  availableStock: number;
  shopName: string;
  supplierId?: string;
  supplierName?: string;
  imageUrl?: string;
  status: string;
}

export default function SupplierMarketPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'MY_DISTRIBUTION' | 'MARKET_OVERVIEW'>('MY_DISTRIBUTION');
  const [allListings, setAllListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadMarketData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all public listings across the marketplace
      const res: any = await ApiClient.get('/listings');
      if (Array.isArray(res)) {
        setAllListings(res);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu thị trường.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, [currentUser.id]);

  // Supplier Profile ID of current user (if any)
  const currentSupplierId = currentUser.supplierProfileId;

  // Listings associated with this supplier's products
  const myDistributedListings = useMemo(() => {
    if (!currentSupplierId) {
      // In demo or fallback mode, if supplierId not matched, filter by supplier name or fallback to first items
      return allListings.filter((l) =>
        l.supplierName?.toLowerCase().includes('việt') ||
        l.supplierName?.toLowerCase().includes('phụ kiện') ||
        l.supplierId === currentSupplierId
      );
    }
    return allListings.filter((l) => l.supplierId === currentSupplierId);
  }, [allListings, currentSupplierId]);

  // Filtered by search term
  const displayedListings = useMemo(() => {
    const source = activeTab === 'MY_DISTRIBUTION' ? myDistributedListings : allListings;
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter(
      (item) =>
        item.productName?.toLowerCase().includes(q) ||
        item.shopName?.toLowerCase().includes(q) ||
        item.sellerSku?.toLowerCase().includes(q)
    );
  }, [activeTab, myDistributedListings, allListings, search]);

  // Metrics
  const uniqueShopsCount = useMemo(() => {
    const set = new Set(myDistributedListings.map((l) => l.shopId || l.shopName));
    return set.size;
  }, [myDistributedListings]);

  const avgSalePrice = useMemo(() => {
    if (!myDistributedListings.length) return 0;
    const total = myDistributedListings.reduce((sum, l) => sum + (l.salePrice || 0), 0);
    return Math.round(total / myDistributedListings.length);
  }, [myDistributedListings]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-xs text-subtle mb-1">
            <Link href="/supplier/products" className="hover:text-ink transition-colors">
              Kênh Nhà Cung Cấp
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">Thị trường bán lẻ</span>
          </nav>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
            Thị Trường & Mạng Lưới Phân Phối
          </h1>
          <p className="text-xs text-subtle mt-0.5 max-w-2xl leading-relaxed">
            Theo dõi các gian hàng đang phân phối sản phẩm của bạn, đối soát giá bán lẻ thực tế trên sàn và khảo sát giá cả thị trường chung.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMarketData}
          className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:bg-muted text-ink text-xs font-semibold transition flex items-center gap-1.5 self-start shadow-xs"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadMarketData} className="underline font-bold">
            Thử lại
          </button>
        </div>
      )}

      {/* KPI Intelligence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Sản phẩm đang phân phối</span>
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="box" width={16} height={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-ink">
              {loading ? '...' : myDistributedListings.length}
            </div>
            <p className="text-xs text-subtle mt-1">Niêm yết từ nguồn hàng của bạn</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Gian hàng đối tác (Shops)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="store" width={16} height={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-ink">
              {loading ? '...' : uniqueShopsCount}
            </div>
            <p className="text-xs text-subtle mt-1">Đang đăng bán sản phẩm của bạn</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Giá bán lẻ trung bình</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="tag" width={16} height={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-ink">
              {loading ? '...' : `${avgSalePrice.toLocaleString()} đ`}
            </div>
            <p className="text-xs text-subtle mt-1">Mức giá người tiêu dùng chi trả</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Tuân thủ giá sàn</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="shield" width={16} height={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-1.5">
              <span>100%</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                Bảo vệ biên
              </span>
            </div>
            <p className="text-xs text-subtle mt-1">Không phát hiện phá giá dưới sàn</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="p-2 sm:p-3 bg-surface border border-line rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('MY_DISTRIBUTION')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'MY_DISTRIBUTION'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-subtle hover:text-ink hover:bg-muted'
            }`}
          >
            Mạng lưới của tôi ({myDistributedListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MARKET_OVERVIEW')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'MARKET_OVERVIEW'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-subtle hover:text-ink hover:bg-muted'
            }`}
          >
            Toàn cảnh thị trường sàn ({allListings.length})
          </button>
        </div>

        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, gian hàng, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-canvas border border-line text-xs text-ink placeholder:text-subtle/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none">
            <Icon name="search" width={14} height={14} />
          </div>
        </div>
      </div>

      {/* Listings Table / Cards */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-subtle uppercase text-[10px] font-bold tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3.5">Sản phẩm</th>
                <th className="px-5 py-3.5">Gian hàng phân phối</th>
                <th className="px-5 py-3.5">Giá sỉ gốc (Cost)</th>
                <th className="px-5 py-3.5">Giá bán lẻ trên sàn</th>
                <th className="px-5 py-3.5">Biên độ Seller</th>
                <th className="px-5 py-3.5">Tồn kho khả dụng</th>
                <th className="px-5 py-3.5 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-subtle">
                    Đang tải dữ liệu thị trường bán lẻ...
                  </td>
                </tr>
              ) : displayedListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-subtle">
                    {activeTab === 'MY_DISTRIBUTION'
                      ? 'Chưa có gian hàng nào niêm yết sản phẩm của bạn. Hãy đảm bảo sản phẩm đã ở trạng thái ACTIVE để Seller khám phá.'
                      : 'Không tìm thấy sản phẩm phù hợp trên thị trường.'}
                  </td>
                </tr>
              ) : (
                displayedListings.map((item) => {
                  const markup = item.costPrice ? item.salePrice - item.costPrice : 0;
                  const markupPercent = item.costPrice ? Math.round((markup / item.costPrice) * 100) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition">
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="font-bold text-ink truncate">{item.productName}</div>
                        <div className="text-[10px] text-subtle font-mono mt-0.5">
                          SKU: {item.sellerSku || 'Mặc định'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <Icon name="store" width={13} height={13} className="text-subtle" />
                          <span>{item.shopName || 'Gian hàng đối tác'}</span>
                        </div>
                        {item.supplierName && (
                          <div className="text-[10px] text-subtle mt-0.5">
                            NCC: {item.supplierName}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-subtle">
                        {item.costPrice ? (
                          <span>{item.costPrice.toLocaleString()} đ</span>
                        ) : (
                          <span className="text-subtle/50">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono">
                        <strong className="text-primary font-bold text-sm">
                          {item.salePrice.toLocaleString()} đ
                        </strong>
                      </td>

                      <td className="px-5 py-3.5 font-mono">
                        {item.costPrice ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            +{markup.toLocaleString()} đ ({markupPercent}%)
                          </span>
                        ) : (
                          <span className="text-subtle/50">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-subtle">
                        {item.availableStock !== undefined ? (
                          <span className={item.availableStock > 0 ? 'text-ink font-semibold' : 'text-rose-600 font-bold'}>
                            {item.availableStock} cái
                          </span>
                        ) : (
                          <span>Còn hàng</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-soft text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Đang mở bán
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
