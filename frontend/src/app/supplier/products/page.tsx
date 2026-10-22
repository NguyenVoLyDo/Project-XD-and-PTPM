'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const [form, setForm] = useState({
    supplierSku: '',
    name: '',
    description: '',
    costPrice: 150000,
    availableStock: 50,
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&auto=format&fit=crop&q=80',
  });

  const loadProducts = async () => {
    try {
      const data: any = await ApiClient.get('/catalog/products', { supplierId: currentUser.supplierProfileId });
      if (Array.isArray(data)) setProducts(data);
    } catch {
      // demo fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/catalog/products', form);
      setToast('Thêm sản phẩm nguồn thành công!');
      setCreateModalOpen(false);
      await loadProducts();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleUpdateStock = async (productId: string, currentStock: number) => {
    const input = prompt('Nhập số lượng tồn kho mới:', String(currentStock));
    if (input === null) return;
    const stock = parseInt(input, 10);
    if (isNaN(stock) || stock < 0) return;

    try {
      await ApiClient.patch(`/inventory/product/${productId}`, { availableStock: stock });
      setToast('Cập nhật tồn kho thành công!');
      await loadProducts();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleUpdateCostPrice = async (productId: string, currentCost: number) => {
    const input = prompt(
      'Nhập giá vốn mới (VND):\n(Lưu ý: Nếu giá vốn tăng làm Seller vi phạm biên lợi nhuận 10%, Listing đó sẽ tự động chuyển sang PAUSED_PRICE_MISMATCH và tạm ẩn khỏi gian hàng)',
      String(currentCost),
    );
    if (input === null) return;
    const cost = parseInt(input, 10);
    if (isNaN(cost) || cost <= 0) return;

    try {
      await ApiClient.put(`/catalog/products/${productId}`, { costPrice: cost });
      setToast('Cập nhật giá vốn thành công (Hệ thống đã revalidate các Listing liên quan)!');
      await loadProducts();
      setTimeout(() => setToast(null), 3500);
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
          <h1 className="text-3xl font-black text-white tracking-tight">Sản phẩm & Tồn kho nguồn</h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý danh mục sản phẩm nguồn, SKU, giá vốn giao buôn và số lượng tồn kho khả dụng cho các Seller dropship.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>+ Thêm sản phẩm nguồn</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800"></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-slate-800">
          <p className="text-slate-400 text-sm">Chưa có sản phẩm nguồn nào trong kho.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(p => (
            <div key={p.id} className="glass-panel p-5 rounded-2xl border border-slate-800">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-indigo-400 font-bold uppercase">{p.supplierSku}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.availableStock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {p.availableStock > 0 ? 'Còn hàng' : 'Hết hàng'}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base mt-0.5">{p.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{p.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 self-end md:self-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tồn kho khả dụng</div>
                    <div className="text-base font-extrabold text-white">
                      {p.availableStock} chiếc
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Giá vốn cung cấp</div>
                    <div className="text-base font-extrabold text-indigo-300">
                      {p.costPrice.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStock(p.id, p.availableStock)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
                    >
                      Cập nhật tồn
                    </button>
                    <button
                      onClick={() => handleUpdateCostPrice(p.id, p.costPrice)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition"
                    >
                      Đổi giá vốn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Product Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Thêm sản phẩm nguồn mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Mã SKU của NCC</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ANKER-30W-NEW"
                    value={form.supplierSku}
                    onChange={e => setForm({ ...form, supplierSku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Tồn kho ban đầu</label>
                  <input
                    type="number"
                    required
                    value={form.availableStock}
                    onChange={e => setForm({ ...form, availableStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tên sản phẩm</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mô tả sản phẩm</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Giá vốn giao buôn (VND)</label>
                <input
                  type="number"
                  required
                  value={form.costPrice}
                  onChange={e => setForm({ ...form, costPrice: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">URL hình ảnh sản phẩm</label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                />
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Thêm sản phẩm →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
