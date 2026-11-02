'use client';

import { Modal } from '../../../components/ui/modal';
import { productImage } from '../../../lib/product-image';
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
  const minRequiredPrice = selectedProduct?.minimumSalePrice ?? 0;
  const isMarginValid = form.salePrice >= minRequiredPrice;

  const loadData = async () => {
    try {
      const [listRes, shopRes, prodRes]: any = await Promise.all([
        ApiClient.get('/listings/seller/mine'),
        ApiClient.get('/listings/seller/shops'),
        ApiClient.get('/seller/catalog/products'),
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
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không tải được gian hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id, currentUser.sellerProfileId]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMarginValid) {
      alert(`Giá bán lẻ phải tối thiểu là ${minRequiredPrice.toLocaleString()} đ theo chính sách hiện tại`);
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
      <button type="button" className="rounded-lg border px-4 py-2" onClick={async()=>{
        const name=prompt('Tên gian hàng mới:');if(!name?.trim())return;
        try{await ApiClient.post('/listings/seller/shops',{name:name.trim()});await loadData();setToast('Đã tạo gian hàng');}
        catch(error){setToast(error instanceof Error?error.message:'Không tạo được gian hàng');}
      }}>Tạo gian hàng</button>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Gian hàng & giá bán</h1>
          <p className="text-xs text-subtle mt-1">
            Chọn sản phẩm từ Catalog của các Nhà cung cấp, thiết lập giá bán lẻ để phân phối trên gian hàng.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-95 text-ink font-bold text-xs shadow-lg flex items-center gap-2 self-start"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>+ Niêm yết sản phẩm mới</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-canvas animate-pulse border border-line"></div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-line">
          <p className="text-subtle text-sm">Chưa có niêm yết nào trên gian hàng.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map(item => {
            const margin = item.salePrice - item.costPrice;
            const marginPercent = item.costPrice ? Math.round((margin / item.costPrice) * 100) : 0;
            const isPausedMismatch = item.status === 'PAUSED_BY_POLICY' || item.status === 'PAUSED_PRICE_MISMATCH';

            return (
              <div
                key={item.id}
                className={`glass-panel p-5 rounded-2xl border transition ${
                  isPausedMismatch ? 'border-amber-500/50 bg-amber-950/20' : 'border-line'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={productImage(item.productImage)}
                      width={96}
                      height={96}
                      alt={item.productName}
                      className="w-16 h-16 rounded-xl object-cover bg-canvas border border-line shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary font-semibold uppercase">{item.sellerSku}</span>
                        {item.status === 'ACTIVE' && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                            Đang mở bán
                          </span>
                        )}
                        {isPausedMismatch && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30">
                            Tạm ẩn do vi phạm Margin
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-ink text-base mt-0.5">{item.productName}</h3>
                      <div className="text-xs text-subtle">
                        Kho: <strong className="text-ink">{item.supplierName}</strong> | Gian hàng: {item.shopName}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Action */}
                  <div className="flex flex-wrap items-center gap-6 self-end md:self-center">
                    <div>
                      <div className="text-xs text-subtle ">Giá vốn NCC</div>
                      <div className="text-sm font-bold text-ink">
                        {item.costPrice.toLocaleString('vi-VN')} đ
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-subtle ">Giá bán lẻ</div>
                      <div className="text-base font-bold text-pink-700">
                        {item.salePrice.toLocaleString('vi-VN')} đ
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-subtle ">Lợi nhuận gộp</div>
                      <div className={`text-sm font-bold ${margin > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        +{margin.toLocaleString('vi-VN')} đ ({marginPercent}%)
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdatePrice(item.id, item.salePrice)}
                      className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted text-xs font-semibold text-ink border border-line transition"
                    >
                      Sửa giá bán
                    </button>
                  </div>
                </div>

                {isPausedMismatch && (
                  <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-700 bg-amber-950/40 p-2.5 rounded-xl">
                    <span>
                      ⚠️ <strong>Cảnh báo:</strong> Giá bán hiện tại không đạt mức tối thiểu theo chính sách. Hãy cập nhật giá bán để mở lại niêm yết.
                    </span>
                    <button
                      onClick={() => handleUpdatePrice(item.id, item.minimumSalePrice ?? item.costPrice)}
                      className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shrink-0 ml-4"
                    >
                      Cập nhật giá
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
        <Modal title="Tạo niêm yết" onClose={() => setCreateModalOpen(false)}>
            <form onSubmit={handleCreateListing} className="space-y-4 text-sm">
              <div>
                <label htmlFor="partner-field-1" className="block text-subtle mb-1">Chọn gian hàng của bạn</label>
                <select id="partner-field-1" name="partner-field-1" value={form.shopId}
                  onChange={e => setForm({ ...form, shopId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink"
                >
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="partner-field-2" className="block text-subtle mb-1">Chọn sản phẩm nguồn từ NCC</label>
                <select id="partner-field-2" name="partner-field-2" value={form.productId}
                  onChange={e => {
                    const prodId = e.target.value;
                    const prod = catalogProducts.find(p => p.id === prodId);
                    setForm({
                      ...form,
                      productId: prodId,
                      salePrice: prod ? Math.round(prod.costPrice * 1.25) : form.salePrice,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink"
                >
                  {catalogProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Giá vốn: {p.costPrice.toLocaleString()} đ (Kho: {p.availableStock})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                  <div className="text-subtle">Giá vốn nguồn NCC: <strong className="text-ink">{selectedProduct.costPrice.toLocaleString()} đ</strong></div>
                  <div className="text-subtle">Giá bán tối thiểu: <strong className="text-emerald-700">{minRequiredPrice.toLocaleString()} đ</strong></div>
                </div>
              )}

              <div>
                <label htmlFor="partner-field-3" className="block text-subtle mb-1">Mã SKU riêng của gian hàng (Tùy chọn)</label>
                <input id="partner-field-3" name="partner-field-3" type="text"
                  placeholder="Ví dụ: TS-ANKER-01"
                  value={form.sellerSku}
                  onChange={e => setForm({ ...form, sellerSku: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink font-mono"
                />
              </div>

              <div>
                <label htmlFor="partner-field-4" className="block text-subtle mb-1">Giá bán lẻ niêm yết (VND)</label>
                <input id="partner-field-4" name="partner-field-4" type="number"
                  required
                  value={form.salePrice}
                  onChange={e => setForm({ ...form, salePrice: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full px-3 py-2 rounded-xl bg-canvas border text-ink font-bold text-sm ${
                    isMarginValid ? 'border-emerald-500/50' : 'border-rose-500'
                  }`}
                />
                {!isMarginValid && (
                  <p className="text-xs text-rose-700 mt-1">
                    Giá bán phải &gt;= {minRequiredPrice.toLocaleString()} đ theo chính sách hiện tại.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-ink"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!isMarginValid}
                  className={`px-4 py-2 rounded-xl font-bold ${
                    isMarginValid
                      ? 'bg-primary hover:bg-primary-hover text-ink'
                      : 'bg-muted text-subtle cursor-not-allowed'
                  }`}
                >
                  Tạo niêm yết →
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
