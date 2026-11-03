'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Modal } from '../../../components/ui/modal';
import { CreateShopModal, RetailPriceModal } from '../../../components/modals';
import { productImage } from '../../../lib/product-image';
import { ApiClient } from '../../../lib/api';
import { ListingItem } from '../../../lib/types';
import { useAuth } from '../../../lib/auth-context';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';

export default function SellerListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createShopModalOpen, setCreateShopModalOpen] = useState(false);
  const [activePriceItem, setActivePriceItem] = useState<ListingItem | null>(null);
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { currentUser } = useAuth();

  // Create listing form state
  const [form, setForm] = useState({
    shopId: '',
    productId: '',
    sellerSku: '',
    salePrice: 200000,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedProduct = catalogProducts.find((p) => p.id === form.productId);
  const minRequiredPrice = selectedProduct?.minimumSalePrice ?? (selectedProduct ? Math.ceil(selectedProduct.costPrice * 1.1) : 0);
  const isMarginValid = form.salePrice >= minRequiredPrice;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [listRes, shopRes, prodRes]: any = await Promise.all([
        ApiClient.get('/listings/seller/mine'),
        ApiClient.get('/listings/seller/shops'),
        ApiClient.get('/seller/catalog/products'),
      ]);

      if (Array.isArray(listRes)) setListings(listRes);
      if (Array.isArray(shopRes)) {
        setShops(shopRes);
        if (shopRes.length > 0 && !form.shopId) {
          setForm((f) => ({ ...f, shopId: shopRes[0].id }));
        }
      }
      if (Array.isArray(prodRes)) {
        setCatalogProducts(prodRes);
        if (prodRes.length > 0 && !form.productId) {
          setForm((f) => ({
            ...f,
            productId: prodRes[0].id,
            salePrice: Math.round(prodRes[0].costPrice * 1.25),
          }));
        }
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tải được danh sách gian hàng', 'error');
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
      setCreateError(`Giá bán lẻ phải tối thiểu là ${minRequiredPrice.toLocaleString()} đ để đảm bảo biên lợi nhuận sàn.`);
      return;
    }

    try {
      setCreateError(null);
      await ApiClient.post('/listings', form);
      showToast('Tạo niêm yết mới thành công!');
      setCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Không thể tạo niêm yết.');
    }
  };

  const handleUpdatePriceConfirm = async (newPrice: number) => {
    if (!activePriceItem) return;
    try {
      await ApiClient.put(`/listings/${activePriceItem.id}`, { salePrice: newPrice });
      showToast('Cập nhật giá bán thành công!');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật giá bán', 'error');
    }
  };

  const handleCreateShopConfirm = async (shopName: string) => {
    try {
      await ApiClient.post('/listings/seller/shops', { name: shopName });
      showToast(`Đã tạo gian hàng "${shopName}" thành công!`);
      await loadData();
    } catch (error: any) {
      showToast(error?.message || 'Không thể tạo gian hàng', 'error');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = listings.length;
    const active = listings.filter((l) => l.status === 'ACTIVE').length;
    const paused = listings.filter(
      (l) => l.status === 'PAUSED_BY_POLICY' || l.status === 'PAUSED_PRICE_MISMATCH',
    ).length;
    const shopCount = shops.length;
    return { total, active, paused, shopCount };
  }, [listings, shops]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    if (selectedShopFilter === 'ALL') return listings;
    return listings.filter((l) => l.shopId === selectedShopFilter);
  }, [listings, selectedShopFilter]);

  if (currentUser.role !== 'SELLER') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center bg-surface border border-line rounded-3xl p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center">
          <Icon name="store" width={24} height={24} />
        </div>
        <h2 className="text-xl font-bold text-ink">Yêu cầu quyền Người bán (Seller)</h2>
        <p className="text-xs text-subtle leading-relaxed">
          {currentUser.id
            ? `Hiện tại bạn đang ở vai trò "${currentUser.name}". Khu vực quản lý gian hàng và niêm yết chỉ dành riêng cho tài khoản Người bán.`
            : 'Vui lòng đăng nhập bằng tài khoản Người bán đã được duyệt để quản lý gian hàng, chọn sản phẩm và định giá bán lẻ.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/login" className="button-link text-xs">Đăng nhập tài khoản Seller</Link>
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
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-primary' : 'bg-danger'
          }`}
        >
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Icon name="store" width={14} height={14} />
            <span>Kênh Quản Trị Người Bán (Seller Portal)</span>
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Gian hàng & Giá bán lẻ</h1>
          <p className="text-xs text-subtle mt-1 max-w-2xl leading-relaxed">
            Chọn sản phẩm từ Catalog của các Nhà cung cấp trong nước, định giá bán lẻ linh hoạt và phân phối trên gian hàng cá nhân.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            onClick={() => setCreateShopModalOpen(true)}
            className="text-xs font-semibold"
          >
            <Icon name="plus" width={16} height={16} />
            <span>Tạo gian hàng mới</span>
          </Button>
          <Button onClick={() => setCreateModalOpen(true)} className="text-xs font-semibold">
            <Icon name="tag" width={16} height={16} />
            <span>+ Niêm yết sản phẩm</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row - Modern SaaS KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng niêm yết</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-ink">
              <Icon name="tag" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-ink mt-2">{metrics.total}</div>
          <span className="text-[11px] text-subtle mt-1 block">Sản phẩm trên gian hàng</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider text-success">Đang mở bán</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line text-subtle flex items-center justify-center">
              <Icon name="check" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-success mt-2">{metrics.active}</div>
          <span className="text-[11px] text-subtle mt-1 block">Đạt chuẩn Margin sàn</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider text-warning">Tạm ẩn (Margin)</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line text-subtle flex items-center justify-center">
              <Icon name="alert" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-warning mt-2">{metrics.paused}</div>
          <span className="text-[11px] text-subtle mt-1 block">Cần điều chỉnh giá bán</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Gian hàng sở hữu</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line text-subtle flex items-center justify-center">
              <Icon name="store" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-primary mt-2">{metrics.shopCount}</div>
          <span className="text-[11px] text-subtle mt-1 block">Kênh phân phối trực tuyến</span>
        </div>
      </div>

      {/* Filter by shop */}
      {shops.length > 0 && (
        <div className="p-4 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-subtle">
            <Icon name="store" width={16} height={16} />
            <span>Xem theo gian hàng:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedShopFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedShopFilter === 'ALL'
                  ? 'bg-primary text-on-primary'
                  : 'bg-canvas text-subtle hover:text-ink hover:bg-muted border border-line'
              }`}
            >
              Tất cả gian hàng ({listings.length})
            </button>
            {shops.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedShopFilter(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  selectedShopFilter === s.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-canvas text-subtle hover:text-ink hover:bg-muted border border-line'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Listings List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse border border-line" />
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-3xl border border-line">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-3">
            <Icon name="store" width={24} height={24} />
          </div>
          <h3 className="text-base font-bold text-ink">Chưa có niêm yết nào trên gian hàng</h3>
          <p className="text-xs text-subtle mt-1 max-w-sm mx-auto">
            Hãy bấm "+ Niêm yết sản phẩm" để chọn mặt hàng từ kho Nhà cung cấp và bắt đầu bán lẻ.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredListings.map((item) => {
            const margin = item.salePrice - item.costPrice;
            const marginPercent = item.costPrice ? Math.round((margin / item.costPrice) * 100) : 0;
            const isPausedMismatch =
              item.status === 'PAUSED_BY_POLICY' || item.status === 'PAUSED_PRICE_MISMATCH';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isPausedMismatch
                    ? 'bg-amber-500/5 border-amber-500/40'
                    : 'bg-surface border-line hover:border-primary/30'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={productImage(item.productImage) || '/images/earbuds.jpg'}
                      width={88}
                      height={88}
                      alt={item.productName}
                      className="w-20 h-20 rounded-2xl object-cover bg-canvas border border-line shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-primary font-bold uppercase bg-primary-soft px-2 py-0.5 rounded">
                          {item.sellerSku || 'SKU'}
                        </span>
                        {item.status === 'ACTIVE' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success-soft text-success border border-success/25">
                            Đang mở bán
                          </span>
                        )}
                        {isPausedMismatch && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-warning-soft text-warning border border-warning/25">
                            Tạm ẩn do vi phạm Margin
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-ink text-base truncate">{item.productName}</h3>
                      <div className="text-xs text-subtle mt-0.5">
                        Kho: <strong className="text-ink">{item.supplierName}</strong> | Gian hàng:{' '}
                        <span className="text-primary font-medium">{item.shopName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financials & Action */}
                  <div className="flex flex-wrap items-center gap-6 self-end md:self-center shrink-0">
                    <div className="text-right sm:text-left">
                      <span className="text-[11px] text-subtle block">Giá vốn NCC</span>
                      <span className="text-sm font-bold text-ink">
                        {item.costPrice.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <div className="text-right sm:text-left">
                      <span className="text-[11px] text-subtle block">Giá bán lẻ</span>
                      <span className="text-base font-bold text-primary">
                        {item.salePrice.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <div className="text-right sm:text-left">
                      <span className="text-[11px] text-subtle block">Lợi nhuận gộp</span>
                      <span
                        className={`text-sm font-bold ${
                          margin > 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        +{margin.toLocaleString('vi-VN')} đ ({marginPercent}%)
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivePriceItem(item)}
                      className="text-xs font-semibold"
                    >
                      <Icon name="edit" width={14} height={14} />
                      <span>Sửa giá bán</span>
                    </Button>
                  </div>
                </div>

                {isPausedMismatch && (
                  <div className="mt-4 pt-3 border-t border-warning/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-warning-soft text-ink p-3.5 rounded-xl border border-warning/20">
                    <div className="flex items-center gap-2">
                      <Icon name="alert" width={16} height={16} className="text-warning shrink-0" />
                      <span>
                        <strong className="text-ink">Cảnh báo biên lợi nhuận:</strong> Giá vốn từ NCC đã tăng khiến giá bán hiện tại không đạt tối thiểu 10% Margin. Hãy tăng giá bán lẻ để tự động kích hoạt lại niêm yết trên sàn.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setActivePriceItem(item)}
                      className="shrink-0 text-xs font-bold"
                    >
                      Cập nhật giá ngay
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Retail Price Adjustment Modal */}
      {activePriceItem && (
        <RetailPriceModal
          productName={activePriceItem.productName}
          sellerSku={activePriceItem.sellerSku}
          currentPrice={activePriceItem.salePrice}
          costPrice={activePriceItem.costPrice}
          minimumPrice={activePriceItem.minimumSalePrice}
          onConfirm={handleUpdatePriceConfirm}
          onClose={() => setActivePriceItem(null)}
        />
      )}

      {/* Create Shop Modal */}
      {createShopModalOpen && (
        <CreateShopModal
          onConfirm={handleCreateShopConfirm}
          onClose={() => setCreateShopModalOpen(false)}
        />
      )}

      {/* Create Listing Modal */}
      {createModalOpen && (
        <Modal
          title="Niêm yết sản phẩm mới"
          subtitle="Chọn sản phẩm nguồn và thiết lập giá bán lẻ trên gian hàng của bạn"
          onClose={() => setCreateModalOpen(false)}
          maxWidth="lg"
        >
          <form onSubmit={handleCreateListing} className="space-y-4 text-sm">
            {createError && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div>
              <label htmlFor="listing-shop-select" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Chọn gian hàng phân phối (*)
              </label>
              <select
                id="listing-shop-select"
                value={form.shopId}
                onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="listing-prod-select" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Chọn sản phẩm nguồn từ NCC (*)
              </label>
              <select
                id="listing-prod-select"
                value={form.productId}
                onChange={(e) => {
                  const prodId = e.target.value;
                  const prod = catalogProducts.find((p) => p.id === prodId);
                  setForm({
                    ...form,
                    productId: prodId,
                    salePrice: prod ? Math.round(prod.costPrice * 1.25) : form.salePrice,
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {catalogProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Giá vốn: {p.costPrice.toLocaleString()} đ (Kho: {p.availableStock})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1 text-xs">
                <div className="text-subtle">
                  Giá vốn NCC: <strong className="text-ink">{selectedProduct.costPrice.toLocaleString()} đ</strong>
                </div>
                <div className="text-subtle">
                  Giá bán tối thiểu (Margin 10%):{' '}
                  <strong className="text-emerald-700">{minRequiredPrice.toLocaleString()} đ</strong>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="listing-sku-input" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Mã SKU riêng của gian hàng (Tùy chọn)
              </label>
              <input
                id="listing-sku-input"
                type="text"
                placeholder="Ví dụ: TS-ANKER-01"
                value={form.sellerSku}
                onChange={(e) => setForm({ ...form, sellerSku: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-ink font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="listing-saleprice-input" className="block text-xs font-semibold uppercase text-subtle mb-1.5">
                Giá bán lẻ niêm yết (VND) (*)
              </label>
              <div className="relative">
                <input
                  id="listing-saleprice-input"
                  type="number"
                  min={minRequiredPrice}
                  step="any"
                  required
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: parseInt(e.target.value, 10) || 0 })}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-canvas border text-ink font-bold text-sm focus:outline-none focus:ring-2 ${
                    isMarginValid ? 'border-line focus:ring-primary' : 'border-rose-400 focus:ring-rose-500'
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-subtle">
                  VND
                </span>
              </div>
              {!isMarginValid && (
                <p className="text-xs text-rose-700 mt-1">
                  Giá bán phải đạt tối thiểu {minRequiredPrice.toLocaleString()} đ theo chính sách sàn.
                </p>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-line">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="default" disabled={!isMarginValid}>
                Tạo niêm yết mới
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
