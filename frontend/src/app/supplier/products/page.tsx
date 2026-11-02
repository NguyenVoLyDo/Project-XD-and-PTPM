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
    imageUrl: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const openCreateModal = () => {
    setForm({
      supplierSku: '',
      name: '',
      description: '',
      costPrice: 150000,
      availableStock: 50,
      imageUrl: '',
    });
    setImageFile(null);
    setCreateModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn một file ảnh hợp lệ');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh không được vượt quá 10MB');
      return;
    }

    try {
      setUploadingImage(true);
      const res = await ApiClient.uploadFile(file);
      setForm(prev => ({ ...prev, imageUrl: res.url }));
      setImageFile(file);
      setToast('Tải ảnh lên máy chủ thành công!');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Không thể tải ảnh lên: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data: any = await ApiClient.get('/supplier/products');
      if (Array.isArray(data)) setProducts(data);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Không tải được sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentUser.id, currentUser.supplierProfileId]);

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
          onClick={openCreateModal}
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
                <label className="block text-subtle mb-1 font-medium">Hình ảnh sản phẩm (Tải lên máy chủ)</label>
                {form.imageUrl ? (
                  <div className="flex items-center gap-4 p-3 rounded-xl border border-line bg-canvas">
                    <img
                      src={productImage(form.imageUrl)}
                      alt="Xem trước hình ảnh"
                      className="w-20 h-20 rounded-lg object-cover bg-muted border border-line shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Đã lưu trên máy chủ</span>
                      </div>
                      <p className="text-xs text-subtle font-mono truncate mt-0.5" title={form.imageUrl}>
                        Đường dẫn: {form.imageUrl}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, imageUrl: '' });
                          setImageFile(null);
                        }}
                        className="mt-2 text-xs text-rose-500 hover:text-rose-600 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Xóa và chọn ảnh khác
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label
                      htmlFor="product-image-upload"
                      className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
                        uploadingImage
                          ? 'border-primary/50 bg-primary-soft/10 cursor-not-allowed'
                          : 'border-line hover:border-primary/60 bg-canvas/60 hover:bg-canvas'
                      }`}
                    >
                      {uploadingImage ? (
                        <div className="flex flex-col items-center py-2 text-center">
                          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                          <span className="text-xs font-semibold text-primary">Đang tải ảnh lên máy chủ...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-ink">Bấm để tải ảnh từ máy lên</span>
                          <span className="text-[11px] text-subtle mt-0.5">Định dạng JPG, PNG, WEBP, GIF (Tối đa 10MB)</span>
                        </div>
                      )}
                      <input
                        id="product-image-upload"
                        name="product-image-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        disabled={uploadingImage}
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  </div>
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
                  disabled={uploadingImage}
                  className={`px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-ink font-bold transition ${
                    uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingImage ? 'Đang tải ảnh...' : 'Thêm sản phẩm →'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
