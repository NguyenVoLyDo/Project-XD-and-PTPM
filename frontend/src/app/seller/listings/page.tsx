'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../lib/api';
import { ListingItem } from '../../../lib/types';
import { useAuth } from '../../../lib/auth-context';

export default function SellerListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Create form state
  const [form, setForm] = useState({
    shopId: '',
    productId: '',
    sellerSku: '',
    salePrice: 200000,
  });

  const selectedProduct = catalogProducts.find(p => p.id === form.productId);
  const minRequiredPrice = selectedProduct ? Math.round(selectedProduct.costPrice * 1.1) : 0;
  const isMarginValid = form.salePrice >= minRequiredPrice;

  const loadData = async () => {
    try {
      const [listRes, shopRes, prodRes]: any = await Promise.all([
        ApiClient.get('/listings/seller/mine'),
        ApiClient.get('/listings/seller/shops'),
        ApiClient.get('/catalog/products'),
      ]);

      if (Array.isArray(listRes)) setListings(listRes);
      if (Array.isArray(shopRes)) {
        setShops(shopRes);
        if (shopRes.length > 0 && !form.shopId) setForm(f => ({ ...f, shopId: shopRes[0].id }));
      }
      if (Array.isArray(prodRes)) {
        setCatalogProducts(prodRes);
        if (prodRes.length > 0 && !form.productId) {
          setForm(f => ({ ...f, productId: prodRes[0].id, salePrice: Math.round(prodRes[0].costPrice * 1.25) }));
        }
      }
    } catch {
      // demo fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMarginValid) {
      alert(`Giá bán lẻ phải tối thiểu là ${minRequiredPrice.toLocaleString()} đ (đảm bảo biên lợi nhuận >= 10%)`);
      return;
    }

    try {
      await ApiClient.post('/listings', form);
      setToast('Tạo niêm yết mới thành công!');
      setCreateModalOpen(false);
      await loadData();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleUpdatePrice = async (listingId: string, currentPrice: number) => {
    const newPriceStr = prompt('Nhập giá bán mới (VND):', String(currentPrice));
    if (!newPriceStr) return;
    const newPrice = parseInt(newPriceStr, 10);
    if (isNaN(newPrice) || newPrice <= 0) return;

    try {
      await ApiClient.put(`/listings/${listingId}`, { salePrice: newPrice });
      setToast('Cập nhật giá bán thành công!');
      await loadData();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Quản lý Niêm yết & Giá bán</h1>
          <p className="text-xs text-slate-400 mt-1">
            Chọn sản phẩm từ Catalog của các Nhà cung cấp, thiết lập giá bán lẻ để phân phối trên gian hàng.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>+ Niêm yết sản phẩm mới</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800"></div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-slate-800">
          <p className="text-slate-400 text-sm">Chưa có niêm yết nào trên gian hàng.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map(item => {
            const margin = item.salePrice - item.costPrice;
            const marginPercent = Math.round((margin / item.costPrice) * 100);
            const isPausedMismatch = item.status === 'PAUSED_PRICE_MISMATCH';

            return (
              <div
                key={item.id}
                className={`glass-panel p-5 rounded-2xl border transition ${
                  isPausedMismatch ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-indigo-400 font-semibold uppercase">{item.sellerSku}</span>
                        {item.status === 'ACTIVE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Đang mở bán
                          </span>
                        )}
                        {isPausedMismatch && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Tạm ẩn do vi phạm Margin
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-white text-base mt-0.5">{item.productName}</h3>
                      <div className="text-xs text-slate-400">
                        Kho: <strong className="text-slate-300">{item.supplierName}</strong> | Gian hàng: {item.shopName}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Action */}
                  <div className="flex flex-wrap items-center gap-6 self-end md:self-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Giá vốn NCC</div>
                      <div className="text-sm font-bold text-slate-300">
                        {item.costPrice.toLocaleString('vi-VN')} đ
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Giá bán lẻ</div>
                      <div className="text-base font-extrabold text-pink-400">
                        {item.salePrice.toLocaleString('vi-VN')} đ
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Lợi nhuận gộp</div>
                      <div className={`text-sm font-bold ${margin > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        +{margin.toLocaleString('vi-VN')} đ ({marginPercent}%)
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdatePrice(item.id, item.salePrice)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
                    >
                      Sửa giá bán
                    </button>
                  </div>
                </div>

                {isPausedMismatch && (
                  <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-xl">
                    <span>
                      ⚠️ <strong>Cảnh báo:</strong> NCC vừa tăng giá vốn. Giá bán lẻ hiện tại của bạn không đạt biên lợi nhuận tối thiểu 10%. Hãy tăng giá bán để tự động mở lại listing!
                    </span>
                    <button
                      onClick={() => handleUpdatePrice(item.id, Math.round(item.costPrice * 1.15))}
                      className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shrink-0 ml-4"
                    >
                      Tăng giá ngay (+15%)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Listing Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-slate-700 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Tạo niêm yết bán lẻ từ Catalog NCC</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Chọn gian hàng của bạn</label>
                <select
                  value={form.shopId}
                  onChange={e => setForm({ ...form, shopId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                >
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Chọn sản phẩm nguồn từ NCC</label>
                <select
                  value={form.productId}
                  onChange={e => {
                    const prodId = e.target.value;
                    const prod = catalogProducts.find(p => p.id === prodId);
                    setForm({
                      ...form,
                      productId: prodId,
                      salePrice: prod ? Math.round(prod.costPrice * 1.25) : form.salePrice,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                >
                  {catalogProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Giá vốn: {p.costPrice.toLocaleString()} đ (Kho: {p.availableStock})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-slate-400">Giá vốn nguồn NCC: <strong className="text-white">{selectedProduct.costPrice.toLocaleString()} đ</strong></div>
                  <div className="text-slate-400">Biên lợi nhuận sàn yêu cầu (10%): <strong className="text-emerald-400">{minRequiredPrice.toLocaleString()} đ</strong></div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Mã SKU riêng của gian hàng (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: TS-ANKER-01"
                  value={form.sellerSku}
                  onChange={e => setForm({ ...form, sellerSku: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Giá bán lẻ niêm yết (VND)</label>
                <input
                  type="number"
                  required
                  value={form.salePrice}
                  onChange={e => setForm({ ...form, salePrice: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white font-bold text-sm ${
                    isMarginValid ? 'border-emerald-500/50' : 'border-rose-500'
                  }`}
                />
                {!isMarginValid && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    Giá bán phải &gt;= {minRequiredPrice.toLocaleString()} đ (đảm bảo biên lợi nhuận tối thiểu 10%).
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!isMarginValid}
                  className={`px-4 py-2 rounded-xl font-bold ${
                    isMarginValid
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Tạo niêm yết →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
