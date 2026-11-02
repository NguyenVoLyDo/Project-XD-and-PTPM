'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Modal } from '../../../components/ui/modal';
import { StockModal, CostPriceModal } from '../../../components/modals';
import { productImage } from '../../../lib/product-image';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeStockProduct, setActiveStockProduct] = useState<any | null>(null);
  const stockRequest = useRef<{ fingerprint: string; sourceRef: string } | null>(null);
  const [activeCostProduct, setActiveCostProduct] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openCreateModal = () => {
    setForm({
      supplierSku: '',
      name: '',
      description: '',
      costPrice: 150000,
      availableStock: 50,
      imageUrl: '',
    });
    setUploadError(null);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn một file ảnh hợp lệ (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng ảnh không được vượt quá 10MB.');
      return;
    }

    try {
      setUploadError(null);
      setUploadingImage(true);
      const res = await ApiClient.uploadFile(file);
      setForm((prev) => ({ ...prev, imageUrl: res.url }));
      showToast('Tải ảnh sản phẩm lên thành công!');
    } catch (err: any) {
      setUploadError(err.message || 'Không thể tải ảnh lên máy chủ.');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data: any = await ApiClient.get('/supplier/products');
      if (Array.isArray(data)) setProducts(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tải được danh sách sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentUser.id, currentUser.supplierProfileId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await ApiClient.post('/catalog/products', form);
      showToast('Thêm sản phẩm nguồn thành công!');
      setCreateModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo sản phẩm nguồn.');
    }
  };

  const handleUpdateStockConfirm = async (newStock: number) => {
    if (!activeStockProduct) return;
    try {
      const delta = newStock - activeStockProduct.onHand;
      const fingerprint = JSON.stringify([activeStockProduct.id, activeStockProduct.onHand, newStock]);
      if (stockRequest.current?.fingerprint !== fingerprint) {
        stockRequest.current = { fingerprint, sourceRef: crypto.randomUUID() };
      }
      await ApiClient.post('/supplier/inventory/adjustments', {
        productId: activeStockProduct.id, delta, expectedOnHand: activeStockProduct.onHand,
        sourceRef: stockRequest.current.sourceRef, reasonCode: 'MANUAL_ADJUSTMENT',
      });
      showToast('Cập nhật tồn kho thành công!');
      await loadProducts();
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật tồn kho', 'error');
      throw err;
    }
  };

  const handleUpdateCostPriceConfirm = async (newCost: number) => {
    if (!activeCostProduct) return;
    try {
      await ApiClient.put(`/catalog/products/${activeCostProduct.id}`, { costPrice: newCost });
      showToast('Cập nhật giá vốn thành công (Hệ thống đã revalidate các Listing liên quan)!');
      await loadProducts();
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật giá vốn', 'error');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => (p.availableStock || 0) > 0).length;
    const outOfStock = total - inStock;
    const totalUnits = products.reduce((acc, p) => acc + (p.onHand || 0), 0);
    return { total, inStock, outOfStock, totalUnits };
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search.trim() ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.supplierSku || '').toLowerCase().includes(search.toLowerCase());
      const matchStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'IN_STOCK' && (p.availableStock || 0) > 0) ||
        (stockFilter === 'OUT_OF_STOCK' && (p.availableStock || 0) <= 0);
      return matchSearch && matchStock;
    });
  }, [products, search, stockFilter]);

  if (currentUser.role !== 'SUPPLIER') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center bg-surface border border-line rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 mx-auto flex items-center justify-center">
          <Icon name="box" width={24} height={24} />
        </div>
        <h2 className="text-xl font-bold text-ink">Yêu cầu quyền Nhà cung cấp (Supplier)</h2>
        <p className="text-xs text-subtle leading-relaxed">
          {currentUser.id
            ? `Hiện tại bạn đang ở vai trò "${currentUser.name}". Khu vực quản lý sản phẩm nguồn và kho chỉ dành riêng cho tài khoản Nhà cung cấp.`
            : 'Vui lòng đăng nhập bằng tài khoản Nhà cung cấp đã được duyệt để quản lý danh mục sản phẩm, tồn kho và giá vốn.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/login" className="button-link text-xs">Đăng nhập tài khoản NCC</Link>
          <Link href="/" className="button-link button-link-secondary text-xs">Về trang chủ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-on-primary transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-primary' : 'bg-rose-600'
          }`}
        >
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Icon name="box" width={14} height={14} />
            <span>Kênh Quản Trị Nhà Cung Cấp</span>
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Sản phẩm & Tồn kho nguồn</h1>
          <p className="text-xs text-subtle mt-1 max-w-2xl leading-relaxed">
            Quản lý danh mục sản phẩm nguồn, mã SKU, giá vốn giao buôn và số lượng hàng sẵn sàng để các Seller dropship niêm yết bán lẻ.
          </p>
        </div>

        <Button onClick={openCreateModal} className="self-start sm:self-auto shrink-0">
          <Icon name="plus" width={18} height={18} />
          <span>Thêm sản phẩm mới</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-xs text-subtle font-medium">Tổng sản phẩm</span>
          <div className="text-2xl font-bold text-ink mt-1">{metrics.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-xs text-emerald-700 font-medium">Còn hàng</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.inStock}</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-xs text-rose-700 font-medium">Hết hàng</span>
          <div className="text-2xl font-bold text-rose-700 mt-1">{metrics.outOfStock}</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-xs text-primary font-medium">Tổng lượng tồn kho</span>
          <div className="text-2xl font-bold text-primary mt-1">{metrics.totalUnits} <span className="text-xs font-normal text-subtle">chiếc</span></div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" width={18} height={18} />
          <input
            type="search"
            placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-canvas border border-line text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'IN_STOCK', 'OUT_OF_STOCK'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setStockFilter(mode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                stockFilter === mode
                  ? 'bg-primary text-on-primary'
                  : 'bg-canvas text-subtle hover:text-ink hover:bg-muted border border-line'
              }`}
            >
              {mode === 'ALL' ? 'Tất cả' : mode === 'IN_STOCK' ? 'Còn hàng' : 'Hết hàng'}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse border border-line" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-3xl border border-line">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-3">
            <Icon name="box" width={24} height={24} />
          </div>
          <h3 className="text-base font-bold text-ink">Không tìm thấy sản phẩm nguồn phù hợp</h3>
          <p className="text-xs text-subtle mt-1 max-w-sm mx-auto">
            {products.length === 0
              ? 'Kho của bạn chưa có sản phẩm nào. Hãy bấm "Thêm sản phẩm mới" để bắt đầu cung cấp hàng.'
              : 'Thử tìm với từ khóa khác hoặc chuyển bộ lọc trạng thái tồn kho.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((p) => {
            const inStock = p.availableStock > 0;
            return (
              <div
                key={p.id}
                className="bg-surface p-5 rounded-2xl border border-line hover:border-primary/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={productImage(p.imageUrl) || '/images/earbuds.jpg'}
                    width={88}
                    height={88}
                    alt={p.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-canvas border border-line shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] text-primary font-bold uppercase bg-primary-soft px-2 py-0.5 rounded">
                        {p.supplierSku}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inStock
                            ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-700 border border-rose-500/25'
                        }`}
                      >
                        {inStock ? 'Sẵn sàng giao' : 'Hết hàng tồn'}
                      </span>
                    </div>

                    <h3 className="font-bold text-ink text-base truncate">{p.name}</h3>
                    <p className="text-xs text-subtle line-clamp-1 mt-0.5">{p.description || 'Không có mô tả chi tiết'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 self-end md:self-center shrink-0">
                  <div className="text-right sm:text-left">
                    <span className="text-[11px] text-subtle block">Tồn kho khả dụng</span>
                    <span className="text-base font-bold text-ink">{p.availableStock} chiếc</span>
                  </div>

                  <div className="text-right sm:text-left">
                    <span className="text-[11px] text-subtle block">Giá vốn cung cấp</span>
                    <span className="text-base font-bold text-primary">
                      {p.costPrice.toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { stockRequest.current = null; setActiveStockProduct(p); }}
                      className="text-xs font-semibold"
                    >
                      <Icon name="box" width={14} height={14} />
                      <span>Sửa tồn</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveCostProduct(p)}
                      className="text-xs font-semibold"
                    >
                      <Icon name="tag" width={14} height={14} />
                      <span>Sửa giá vốn</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {activeStockProduct && (
        <StockModal
          productName={activeStockProduct.name}
          sku={activeStockProduct.supplierSku}
          currentStock={activeStockProduct.onHand}
          reserved={activeStockProduct.reserved}
          onConfirm={handleUpdateStockConfirm}
          onClose={() => setActiveStockProduct(null)}
        />
      )}

      {/* Cost Price Adjustment Modal */}
      {activeCostProduct && (
        <CostPriceModal
          productName={activeCostProduct.name}
          sku={activeCostProduct.supplierSku}
          currentCost={activeCostProduct.costPrice}
          onConfirm={handleUpdateCostPriceConfirm}
          onClose={() => setActiveCostProduct(null)}
        />
      )}

      {/* Create Product Modal */}
      {createModalOpen && (
        <Modal
          title="Thêm sản phẩm nguồn mới"
          subtitle="Đăng ký mặt hàng mới vào kho cung ứng để các Seller bắt đầu niêm yết"
          onClose={() => setCreateModalOpen(false)}
          maxWidth="lg"
        >
          <form onSubmit={handleCreate} className="space-y-4 text-sm">
            {formError && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="create-sku" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                  Mã SKU của NCC (*)
                </label>
                <input
                  id="create-sku"
                  type="text"
                  required
                  placeholder="VD: ANKER-30W-NEW"
                  value={form.supplierSku}
                  onChange={(e) => setForm({ ...form, supplierSku: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="create-stock" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                  Tồn kho ban đầu (*)
                </label>
                <input
                  id="create-stock"
                  type="number"
                  min={0}
                  required
                  value={form.availableStock}
                  onChange={(e) => setForm({ ...form, availableStock: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-name" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Tên sản phẩm (*)
              </label>
              <input
                id="create-name"
                type="text"
                required
                placeholder="VD: Củ sạc nhanh Anker 30W GaN nhỏ gọn"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="create-desc" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Mô tả chi tiết sản phẩm
              </label>
              <textarea
                id="create-desc"
                rows={2}
                placeholder="Thông tin công nghệ, công suất, bảo hành..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="create-cost" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Giá vốn giao buôn (VND) (*)
              </label>
              <div className="relative">
                <input
                  id="create-cost"
                  type="number"
                  min={1000}
                  step="any"
                  required
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-subtle">
                  VND
                </span>
              </div>
              <p className="text-[11px] text-subtle mt-1">
                Tương đương: {form.costPrice.toLocaleString('vi-VN')} đ
              </p>
            </div>

            {/* Image upload section */}
            <div>
              <label className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Hình ảnh sản phẩm
              </label>
              {form.imageUrl ? (
                <div className="flex items-center gap-4 p-3.5 rounded-2xl border border-line bg-canvas">
                  <img
                    src={productImage(form.imageUrl)}
                    alt="Xem trước hình ảnh"
                    className="w-20 h-20 rounded-xl object-cover bg-muted border border-line shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <Icon name="check" width={16} height={16} />
                      <span>Đã tải ảnh lên máy chủ</span>
                    </div>
                    <p className="text-xs text-subtle font-mono truncate mt-0.5">{form.imageUrl}</p>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: '' })}
                      className="mt-2 text-xs text-rose-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <Icon name="trash" width={14} height={14} />
                      <span>Xóa và chọn ảnh khác</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
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
                        <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-2">
                          <Icon name="box" width={20} height={20} />
                        </div>
                        <span className="text-xs font-bold text-ink">Bấm để tải ảnh từ máy lên</span>
                        <span className="text-[11px] text-subtle mt-0.5">
                          Định dạng JPG, PNG, WEBP, GIF (Tối đa 10MB)
                        </span>
                      </div>
                    )}
                    <input
                      id="product-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingImage}
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  {uploadError && (
                    <p role="alert" className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>{uploadError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-line">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="default" isLoading={uploadingImage}>
                Tạo sản phẩm nguồn
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
