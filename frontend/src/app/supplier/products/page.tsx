'use client';

import { Modal } from '../../../components/ui/modal';
import { productImage } from '../../../lib/product-image';
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
        <div role="status" className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Sản phẩm & tồn kho</h1>
          <p className="text-xs text-subtle mt-1">
            Quản lý danh mục sản phẩm nguồn, SKU, giá vốn giao buôn và số lượng tồn kho khả dụng cho các Seller dropship.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-95 text-ink font-bold text-xs shadow-lg flex items-center gap-2 self-start"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>+ Thêm sản phẩm nguồn</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-canvas animate-pulse border border-line"></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-line">
          <p className="text-subtle text-sm">Chưa có sản phẩm nguồn nào trong kho.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(p => (
            <div key={p.id} className="glass-panel p-5 rounded-2xl border border-line">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={productImage(p.imageUrl)}
                    width={96}
                    height={96}
                    alt={p.name}
                    className="w-16 h-16 rounded-xl object-cover bg-canvas border border-line shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-bold uppercase">{p.supplierSku}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        p.availableStock > 0 ? 'bg-emerald-500/20 text-emerald-700' : 'bg-rose-500/20 text-rose-700'
                      }`}>
                        {p.availableStock > 0 ? 'Còn hàng' : 'Hết hàng'}
                      </span>
                    </div>

                    <h3 className="font-bold text-ink text-base mt-0.5">{p.name}</h3>
                    <p className="text-xs text-subtle line-clamp-1">{p.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 self-end md:self-center">
                  <div>
                    <div className="text-xs text-subtle ">Tồn kho khả dụng</div>
                    <div className="text-base font-bold text-ink">
                      {p.availableStock} chiếc
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-subtle ">Giá vốn cung cấp</div>
                    <div className="text-base font-bold text-primary">
                      {p.costPrice.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStock(p.id, p.availableStock)}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted text-xs font-semibold text-ink border border-line transition"
                    >
                      Cập nhật tồn
                    </button>
                    <button
                      onClick={() => handleUpdateCostPrice(p.id, p.costPrice)}
                      className="px-3 py-1.5 rounded-xl bg-primary-soft hover:bg-primary-soft text-primary text-xs font-semibold border border-primary/25 transition"
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
        <Modal title="Thêm sản phẩm" onClose={() => setCreateModalOpen(false)}>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="partner-field-1" className="block text-subtle mb-1">Mã SKU của NCC</label>
                  <input id="partner-field-1" name="partner-field-1" type="text"
                    required
                    placeholder="VD: ANKER-30W-NEW"
                    value={form.supplierSku}
                    onChange={e => setForm({ ...form, supplierSku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="partner-field-2" className="block text-subtle mb-1">Tồn kho ban đầu</label>
                  <input id="partner-field-2" name="partner-field-2" type="number"
                    required
                    value={form.availableStock}
                    onChange={e => setForm({ ...form, availableStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="partner-field-3" className="block text-subtle mb-1">Tên sản phẩm</label>
                <input id="partner-field-3" name="partner-field-3" type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink"
                />
              </div>

              <div>
                <label htmlFor="partner-field-4" className="block text-subtle mb-1">Mô tả sản phẩm</label>
                <textarea id="partner-field-4" name="partner-field-4" rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink"
                />
              </div>

              <div>
                <label htmlFor="partner-field-5" className="block text-subtle mb-1">Giá vốn giao buôn (VND)</label>
                <input id="partner-field-5" name="partner-field-5" type="number"
                  required
                  value={form.costPrice}
                  onChange={e => setForm({ ...form, costPrice: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink font-bold"
                />
              </div>

              <div>
                <label htmlFor="partner-field-6" className="block text-subtle mb-1">URL hình ảnh sản phẩm</label>
                <input id="partner-field-6" name="partner-field-6" type="url"
                  value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink font-mono text-xs"
                />
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
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-bold"
                >
                  Thêm sản phẩm →
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
