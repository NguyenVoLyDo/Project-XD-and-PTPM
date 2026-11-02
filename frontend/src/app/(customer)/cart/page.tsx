'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClient } from '../../../lib/api';
import { useAuth, DEMO_ACCOUNTS } from '../../../lib/auth-context';
import { CartItemRow } from '../../../components/organisms/cart/cart-item-row';
import { OrderSummaryCard } from '../../../components/organisms/cart/order-summary-card';
import { EmptyState } from '../../../components/molecules/empty-state';
import { ErrorFallback } from '../../../components/molecules/error-fallback';
import { PurchaseSteps } from '../../../components/storefront/purchase-steps';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { LoginModal } from '../../../components/modals/login-modal';

interface CartItemData {
  listingId: string;
  quantity: number;
  title: string;
  unitSalePrice: number;
  currency: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
}

interface CartData {
  cartId: string;
  items: CartItemData[];
  estimatedMerchandiseTotal: number;
  currency: string;
}

export default function CartPage() {
  const router = useRouter();
  const { currentUser, switchAccount, refreshCartCount } = useAuth();
  const [cart, setCart] = useState<CartData | null>(null);
  const [listingImages, setListingImages] = useState<Record<string, string>>({});
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadCart = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, listings] = await Promise.all([
        ApiClient.get<CartData>('/cart'),
        ApiClient.get<Array<{id: string; productImage: string}>>('/listings').catch(() => []),
      ]);
      setListingImages(Object.fromEntries(listings.map(item => [item.id, item.productImage])));
      if (data && Array.isArray(data.items)) {
        setCart(data);
      } else {
        setCart({ cartId: '', items: [], estimatedMerchandiseTotal: 0, currency: 'VND' });
      }
    } catch (err: any) {
      console.warn('Load cart error:', err.message);
      setError(err.message || 'Không thể kết nối đến máy chủ giỏ hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'CUSTOMER') {
      loadCart();
    } else {
      setLoading(false);
      setError(null);
    }
  }, [currentUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateQuantity = async (listingId: string, newQty: number) => {
    if (newQty <= 0) {
      handleDeleteItem(listingId);
      return;
    }
    setUpdatingId(listingId);
    try {
      const updated: any = await ApiClient.put(`/cart/items/${listingId}`, { quantity: newQty });
      setCart(updated);
      await refreshCartCount();
      showToast('Đã cập nhật số lượng');
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật số lượng', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteItem = async (listingId: string) => {
    setUpdatingId(listingId);
    try {
      const updated: any = await ApiClient.delete(`/cart/items/${listingId}`);
      setCart(updated);
      await refreshCartCount();
      showToast('Đã xóa sản phẩm khỏi giỏ hàng');
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa sản phẩm', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const hasUnavailableItems = Boolean(
    cart?.items && cart.items.some((item) => item.availability === 'UNAVAILABLE'),
  );

  const totalItemCount = cart?.items?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PurchaseSteps current={1} />
      {loginModalOpen && (
        <LoginModal
          actionMessage="Đăng nhập tài khoản để xem và quản lý giỏ hàng của bạn"
          redirectUrl="/cart"
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => {
            setLoginModalOpen(false);
            loadCart();
          }}
        />
      )}
      {pendingRemoval && <Modal title="Xóa sản phẩm khỏi giỏ?" onClose={() => setPendingRemoval(null)}>
        <p className="text-subtle text-sm mb-6">Bạn có thể thêm lại sản phẩm từ trang khám phá.</p>
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setPendingRemoval(null)}>Giữ lại</Button><Button variant="destructive" onClick={() => { handleDeleteItem(pendingRemoval); setPendingRemoval(null); }}>Xóa sản phẩm</Button></div>
      </Modal>}
      {/* Toast Notification */}
      {toast && (
        <div role="status"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-on-primary transition-[color,background-color,border-color,box-shadow,opacity,transform] transform  ${
            toast.type === 'success' ? 'bg-primary' : 'bg-rose-600'
          }`}
        >
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="text-xs text-primary font-semibold  mb-1">
            Kiểm tra sản phẩm trước khi thanh toán
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight flex items-center gap-3">
            <span>Giỏ hàng của bạn</span>
            {totalItemCount > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary/25 font-medium">
                {totalItemCount} sản phẩm
              </span>
            )}
          </h1>
        </div>
        <Link
          href="/catalog"
          className="text-xs text-subtle hover:text-ink flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <span>← Tiếp tục chọn sản phẩm</span>
        </Link>
      </div>

      {/* 3 Network States: Loading -> Error -> Success */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : !currentUser.id ? (
        <EmptyState
          title="Vui lòng đăng nhập để xem giỏ hàng"
          description="Đăng nhập tài khoản khách hàng để lưu giữ, quản lý các sản phẩm bạn muốn mua và tiến hành đặt hàng."
          actionText="Đăng nhập ngay"
          actionHref="/login?redirect=/cart"
          onAction={() => setLoginModalOpen(true)}
        />
      ) : currentUser.role !== 'CUSTOMER' ? (
        <EmptyState
          title="Bạn đang ở vai trò khác"
          description={`Hiện tại bạn đang ở vai trò "${currentUser.name}" (${currentUser.badge}). Giỏ hàng và quy trình thanh toán dành riêng cho Khách mua sắm (Customer).`}
          actionText="Chuyển sang vai trò Khách hàng"
          onAction={() => {
            const customerAcc = DEMO_ACCOUNTS.find((a) => a.role === 'CUSTOMER') || DEMO_ACCOUNTS[0];
            switchAccount(customerAcc).catch(error => showToast(error.message, 'error'));
          }}
        />
      ) : error ? (
        <ErrorFallback
          title="Không thể tải giỏ hàng"
          message={error}
          onRetry={loadCart}
        />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          title="Giỏ hàng của bạn đang trống"
          description="Chưa có sản phẩm nào được thêm vào giỏ. Hãy dạo quanh Catalog để chọn những sản phẩm ưng ý nhất!"
          actionText="Khám phá sản phẩm ngay"
          actionHref="/catalog"
        />
      ) : (
        /* Cart Content Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            {hasUnavailableItems && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs flex items-start gap-3">
                <svg aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-bold">Lưu ý về sản phẩm trong giỏ:</div>
                  <div>Một số sản phẩm đang tạm ngừng bán hoặc hết hàng. Vui lòng xóa trước khi tiến hành thanh toán.</div>
                </div>
              </div>
            )}

            {cart.items.map((item) => (
              <CartItemRow
                image={listingImages[item.listingId]}
                key={item.listingId}
                listingId={item.listingId}
                title={item.title}
                unitSalePrice={item.unitSalePrice}
                quantity={item.quantity}
                availability={item.availability}
                isUpdating={updatingId === item.listingId}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={setPendingRemoval}
              />
            ))}
          </div>

          {/* Cart Summary Card */}
          <OrderSummaryCard
            totalItems={totalItemCount}
            subtotal={cart.estimatedMerchandiseTotal}
            hasUnavailableItems={hasUnavailableItems}
            checkoutHref="/checkout"
          />
        </div>
      )}
    </div>
  );
}
