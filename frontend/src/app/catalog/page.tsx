'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ApiClient } from '../../lib/api';
import { ListingItem } from '../../lib/types';
import { useAuth } from '../../lib/auth-context';

export default function CatalogPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { refreshCartCount } = useAuth();

  useEffect(() => {
    async function loadData() {
      try {
        const data: any = await ApiClient.get('/listings', { search });
        if (Array.isArray(data)) setListings(data);
      } catch {
        // demo fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [search]);

  const handleAddToCart = async (listing: ListingItem) => {
    setAddingId(listing.id);
    try {
      await ApiClient.post('/cart/items', { listingId: listing.id, quantity: 1 });
      await refreshCartCount();
      setToast(`Đã thêm "${listing.productName}" vào giỏ hàng`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(`Lỗi: ${err.message || 'Không thể thêm vào giỏ'}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-sm font-semibold">{toast}</span>
          <Link href="/cart" className="underline text-indigo-200 text-xs hover:text-white">
            Xem giỏ hàng →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Sản phẩm Dropship</h1>
          <p className="text-xs text-slate-400 mt-1">Danh mục sản phẩm đã được niêm yết bán lẻ từ các gian hàng</p>
        </div>

        {/* Search */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, SKU, shop..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800"></div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm">Không tìm thấy sản phẩm nào phù hợp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(item => (
            <div
              key={item.id}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between border border-slate-800"
            >
              <div>
                <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
                    Kho: {item.availableStock}
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/30">
                    {item.shopName}
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Kho nguồn: {item.supplierName}</span>
                  </div>
                  <h3 className="font-bold text-white text-base leading-snug line-clamp-2">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.productDescription}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-slate-800/60 mt-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Giá bán lẻ</div>
                  <div className="text-xl font-extrabold text-pink-400">
                    {item.salePrice.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-400">đ</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAddToCart(item)}
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
    </div>
  );
}
