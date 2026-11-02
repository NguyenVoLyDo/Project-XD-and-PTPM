'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { productImage } from '../../../lib/product-image';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { EmptyState } from '../../../components/molecules/empty-state';
import { PriceDisplay } from '../../../components/molecules/price-display';

interface SourcingProduct {
  id: string;
  name: string;
  supplierSku: string;
  description?: string;
  costPrice: number;
  minimumSalePrice: number;
  availableStock: number;
  supplierName?: string;
  supplierId?: string;
  imageUrl?: string;
}

interface ShopItem {
  id: string;
  name: string;
}

export default function SellerSourcingPage() {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<SourcingProduct[]>([]);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Listing creation modal state
  const [activeModalProduct, setActiveModalProduct] = useState<SourcingProduct | null>(null);
  const [listingForm, setListingForm] = useState({
    shopId: '',
    sellerSku: '',
    salePrice: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prodRes, shopRes]: any = await Promise.all([
        ApiClient.get('/seller/catalog/products'),
        ApiClient.get('/listings/seller/shops'),
      ]);

      if (Array.isArray(prodRes)) setProducts(prodRes);
      if (Array.isArray(shopRes)) {
        setShops(shopRes);
        if (shopRes.length > 0 && !listingForm.shopId) {
          setListingForm((prev) => ({ ...prev, shopId: shopRes[0].id }));
        }
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Không tải được nguồn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'SELLER') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.role]);

  // Extract unique suppliers for filter
  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.supplierId && p.supplierName) {
        map.set(p.supplierId, p.supplierName);
      }
    });
    return Array.from(map.entries());
  }, [products]);

  // Filter products by search and supplier
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.supplierSku.toLowerCase().includes(search.toLowerCase());
      const matchSupplier =
        selectedSupplier === 'ALL' || p.supplierId === selectedSupplier;
      return matchSearch && matchSupplier;
    });
  }, [products, search, selectedSupplier]);

  const handleOpenListModal = (product: SourcingProduct) => {
    setActiveModalProduct(product);
    setModalError(null);
    const rawSuggested = Math.round(product.costPrice * 1.25);
    const suggestedPrice = Math.round(rawSuggested / 1000) * 1000;
    setListingForm({
      shopId: shops.length > 0 ? shops[0].id : '',
      sellerSku: `${product.supplierSku}-SHOP`,
      salePrice: suggestedPrice > product.minimumSalePrice ? suggestedPrice : product.minimumSalePrice,
    });
  };

  const handleCreateListingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalProduct) return;

    if (!listingForm.shopId) {
      setModalError('Vui lòng chọn gian hàng để niêm yết.');
      return;
    }

    if (listingForm.salePrice < activeModalProduct.minimumSalePrice) {
      setModalError(
        `Giá bán lẻ không được thấp hơn giá sàn tối thiểu (${activeModalProduct.minimumSalePrice.toLocaleString()} đ) để đảm bảo biên lợi nhuận sàn.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      await ApiClient.post('/listings', {
        shopId: listingForm.shopId,
        productId: activeModalProduct.id,
        sellerSku: listingForm.sellerSku || `${activeModalProduct.supplierSku}-SKU`,
        salePrice: Number(listingForm.salePrice),
      });

      showToast(`Đã thêm "${activeModalProduct.name}" vào gian hàng thành công!`);
      setActiveModalProduct(null);
    } catch (err: any) {
      setModalError(err instanceof Error ? err.message : 'Không tạo được niêm yết.');
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser.role !== 'SELLER') {
    return (
      <EmptyState
        title="Trang dành riêng cho Người bán (Seller)"
        description="Bạn cần ở vai trò Người bán để xem danh mục nguồn hàng sỉ và thực hiện niêm yết vào gian hàng."
        actionText="Quay lại trang chủ"
        actionHref="/"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-on-primary transition-all animate-in fade-in ${
            toast.type === 'success' ? 'bg-primary' : 'bg-rose-600'
          }`}
        >
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line">
        <div>
          <div className="text-xs font-semibold text-primary mb-1">
            Kênh Người Bán • Nguồn hàng Dropship B2B
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Khám phá nguồn hàng
          </h1>
          <p className="text-xs text-subtle mt-1 max-w-xl">
            Tìm kiếm sản phẩm từ các Nhà cung cấp uy tín, xem giá nhập sỉ và đăng bán vào gian hàng của bạn chỉ với một thao tác.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/seller/listings">
            <Button variant="outline" size="sm" className="font-semibold text-xs">
              <Icon name="store" width={14} height={14} />
              <span>Gian hàng của tôi</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-line">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="search"
              placeholder="Tìm theo tên sản phẩm, mã SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-canvas border border-line text-xs text-ink focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            <span className="absolute right-3 top-2.5 text-subtle pointer-events-none">
              <Icon name="search" width={15} height={15} />
            </span>
          </div>

          {/* Supplier Select */}
          {suppliers.length > 0 && (
            <select
              aria-label="Lọc theo Nhà cung cấp"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="h-10 text-xs bg-canvas rounded-xl border border-line px-3 font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ALL">Tất cả Nhà cung cấp</option>
              {suppliers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs text-subtle text-right whitespace-nowrap">
          Hiển thị <strong>{filteredProducts.length}</strong> sản phẩm nguồn
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-muted animate-pulse border border-line" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-surface border border-line rounded-2xl">
          <p className="text-xs text-rose-600 font-semibold mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm nguồn phù hợp"
          description="Thử thay đổi từ khóa tìm kiếm hoặc lọc theo nhà cung cấp khác."
          actionText="Xóa bộ lọc"
          onAction={() => {
            setSearch('');
            setSelectedSupplier('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map((item) => {
            const outOfStock = item.availableStock <= 0;
            const minMargin = item.minimumSalePrice - item.costPrice;
            const image = productImage(item.imageUrl) || '/images/earbuds.jpg';

            return (
              <div
                key={item.id}
                className="product-card group bg-surface border border-line rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-md transition-all duration-200"
              >
                {/* Product Image */}
                <div className="product-image relative overflow-hidden bg-canvas aspect-4/3">
                  <img
                    src={image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {outOfStock ? (
                    <div className="absolute inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center">
                      <span className="rounded-md px-2.5 py-1 bg-surface text-rose-700 font-bold text-xs shadow-md">
                        Tạm hết hàng
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-md px-2 py-0.5 bg-surface/90 text-primary font-bold text-[10px] shadow-xs">
                        Tồn: {item.availableStock} cái
                      </span>
                    </div>
                  )}
                </div>

                {/* Sourcing Details */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Supplier & SKU */}
                  <div className="flex items-center justify-between text-[11px] text-subtle mb-1">
                    <span className="truncate font-medium">{item.supplierName || 'NCC Đối tác'}</span>
                    <span className="font-mono text-[10px] bg-canvas border border-line px-1.5 py-0.5 rounded">
                      {item.supplierSku}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-2 min-h-10 group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>

                  {/* Wholesale Pricing Metrics */}
                  <div className="mt-3 pt-3 border-t border-line/70 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-subtle text-[11px]">Giá sỉ nhập kho:</span>
                      <strong className="text-ink font-semibold">
                        <PriceDisplay amount={item.costPrice} />
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-subtle text-[11px]">Giá sàn bán lẻ:</span>
                      <span className="text-primary font-semibold text-xs">
                        <PriceDisplay amount={item.minimumSalePrice} />
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-subtle pt-1 border-t border-line/40">
                      <span>Lãi tối thiểu:</span>
                      <span className="text-emerald-700 font-bold">
                        +{minMargin.toLocaleString()} đ
                      </span>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="mt-4 pt-2">
                    <Button
                      variant={outOfStock ? 'secondary' : 'default'}
                      size="sm"
                      disabled={outOfStock}
                      onClick={() => handleOpenListModal(item)}
                      className="w-full text-xs font-semibold rounded-xl"
                    >
                      <Icon name="plus" width={14} height={14} />
                      <span>Đăng bán vào shop</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Listing Modal */}
      {activeModalProduct && (
        <Modal
          title="Đăng bán sản phẩm vào gian hàng"
          subtitle={`Thiết lập giá bán lẻ cho "${activeModalProduct.name}"`}
          onClose={() => setActiveModalProduct(null)}
          maxWidth="md"
        >
          <form onSubmit={handleCreateListingSubmit} className="space-y-4 text-xs">
            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
              >
                <span>⚠️</span>
                <span className="leading-snug">{modalError}</span>
              </div>
            )}

            {/* Product summary box */}
            <div className="p-3 rounded-xl bg-canvas border border-line flex items-center gap-3">
              <img
                src={productImage(activeModalProduct.imageUrl) || '/images/earbuds.jpg'}
                alt={activeModalProduct.name}
                className="w-12 h-12 rounded-lg object-cover bg-surface border border-line shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink text-xs truncate">
                  {activeModalProduct.name}
                </div>
                <div className="text-[11px] text-subtle mt-0.5">
                  Giá sỉ: <strong>{activeModalProduct.costPrice.toLocaleString()} đ</strong> • Giá sàn: <strong>{activeModalProduct.minimumSalePrice.toLocaleString()} đ</strong>
                </div>
              </div>
            </div>

            {/* Shop selection */}
            <div>
              <label htmlFor="modal-shop-select" className="block font-semibold text-ink mb-1.5">
                Chọn gian hàng phân phối (*)
              </label>
              {shops.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  Bạn chưa tạo gian hàng nào. Vui lòng vào{' '}
                  <Link href="/seller/listings" className="underline font-bold">
                    Quản lý gian hàng
                  </Link>{' '}
                  để tạo shop trước.
                </div>
              ) : (
                <select
                  id="modal-shop-select"
                  value={listingForm.shopId}
                  onChange={(e) => setListingForm({ ...listingForm, shopId: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-canvas border border-line text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* SKU */}
            <div>
              <label htmlFor="modal-sku-input" className="block font-semibold text-ink mb-1.5">
                Mã SKU của người bán (Tùy chọn)
              </label>
              <input
                id="modal-sku-input"
                type="text"
                value={listingForm.sellerSku}
                onChange={(e) => setListingForm({ ...listingForm, sellerSku: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-canvas border border-line text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Sale price */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="modal-price-input" className="font-semibold text-ink">
                  Giá bán lẻ mong muốn (*)
                </label>
                <span className="text-[11px] text-subtle">
                  Tối thiểu: <strong className="text-primary">{activeModalProduct.minimumSalePrice.toLocaleString()} đ</strong>
                </span>
              </div>
              <input
                id="modal-price-input"
                type="number"
                min={activeModalProduct.minimumSalePrice}
                step="any"
                value={listingForm.salePrice}
                onChange={(e) => setListingForm({ ...listingForm, salePrice: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-xl bg-canvas border border-line text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>

            {/* Estimated Profit Calculation */}
            {listingForm.salePrice > 0 && (
              <div className="p-3 rounded-xl bg-primary-soft/60 border border-primary/20 flex items-center justify-between text-xs">
                <span className="text-primary font-medium">Lợi nhuận ước tính mỗi đơn:</span>
                <span className="font-extrabold text-primary text-sm font-mono">
                  +{(listingForm.salePrice - activeModalProduct.costPrice).toLocaleString()} đ
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModalProduct(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={submitting || shops.length === 0}
                isLoading={submitting}
              >
                <span>Xác nhận niêm yết</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
