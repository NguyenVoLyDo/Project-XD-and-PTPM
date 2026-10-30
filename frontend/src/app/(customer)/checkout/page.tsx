'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClient } from '../../../lib/api';
import { useAuth, DEMO_ACCOUNTS } from '../../../lib/auth-context';
import { ShippingForm, ShippingFormData } from '../../../components/organisms/checkout/shipping-form';
import { SplitOrderPreview } from '../../../components/organisms/checkout/split-order-preview';
import { OrderSummaryCard } from '../../../components/organisms/cart/order-summary-card';
import { EmptyState } from '../../../components/molecules/empty-state';
import { ErrorFallback } from '../../../components/molecules/error-fallback';
import { PurchaseSteps } from '../../../components/storefront/purchase-steps';
import { Skeleton } from '../../../components/ui/skeleton';

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

export default function CheckoutPage() {
  const router = useRouter();
  const { currentUser, switchAccount, refreshCartCount } = useAuth();
  const [cart, setCart] = useState<CartData | null>(null);
  const [listingOwners, setListingOwners] = useState<Record<string, { supplierId: string; sellerId: string; supplierName?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checkoutAttempt = useRef<{ body: string; key: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingFormData, string>>>({});

  // Form State
  const [formData, setFormData] = useState<ShippingFormData>({
    recipientName: '',
    phone: '',
    line1: '',
    wardCode: '',
    provinceCode: '',
    note: '',
    paymentMethod: 'COD',
  });

  const fetchCart = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, listings] = await Promise.all([
        ApiClient.get<CartData>('/cart'),
        ApiClient.get<Array<{ id: string; supplierId: string; sellerId: string; supplierName?: string }>>('/listings'),
      ]);
      setListingOwners(Object.fromEntries(listings.map((listing) => [listing.id, listing])));
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setCart(data);
      } else {
        setCart({ cartId: '', items: [], estimatedMerchandiseTotal: 0, currency: 'VND' });
      }
    } catch (err: any) {
      console.warn('Fetch cart error in checkout:', err.message);
      setError(err.message || 'Không thể tải giỏ hàng để thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'CUSTOMER') {
      fetchCart();
    } else {
      setLoading(false);
      setError(null);
    }
  }, [currentUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFormChange = (updated: Partial<ShippingFormData>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !(key in updated))));
  };

  const handleCheckout = async () => {
    if (submitting) return;
    const errors: Partial<Record<keyof ShippingFormData, string>> = {};
    if (!formData.recipientName.trim()) errors.recipientName = 'Nhập họ tên người nhận.';
    if (!/^[+0-9 ()-]{8,20}$/.test(formData.phone.trim())) errors.phone = 'Nhập số điện thoại hợp lệ.';
    if (!formData.line1.trim()) errors.line1 = 'Nhập địa chỉ nhận hàng.';
    setFieldErrors(errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) { document.getElementById(firstError)?.focus(); return; }

    if (!cart || !cart.cartId) {
      showToast('Giỏ hàng không hợp lệ hoặc đang trống', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        cartId: cart.cartId,
        paymentMethod: formData.paymentMethod,
        shippingAddress: {
          recipientName: formData.recipientName.trim(),
          phone: formData.phone.trim(),
          line1: formData.line1.trim(),
          wardCode: formData.wardCode.trim() || 'DEFAULT_WARD',
          provinceCode: formData.provinceCode.trim() || 'DEFAULT_PROVINCE',
        },
        note: formData.note?.trim() || undefined,
      };

      const serialized = JSON.stringify(payload);
      if (checkoutAttempt.current?.body !== serialized) {
        checkoutAttempt.current = { body: serialized, key: crypto.randomUUID() };
      }
      const res: any = await ApiClient.post('/checkout', payload, {
        'idempotency-key': checkoutAttempt.current.key,
      });

      await refreshCartCount();
      showToast('Đã tạo đơn hàng. Đang mở chi tiết…');

      setTimeout(() => {
        const orderId = res.orderId || res.id;
        if (orderId) {
          router.push(`/orders/${orderId}`);
        } else {
          router.push('/orders');
        }
      }, 1000);
    } catch (err: any) {
      console.error('Checkout error:', err);
      showToast(err.message || 'Đặt hàng thất bại. Vui lòng kiểm tra lại.', 'error');
      setSubmitting(false);
    }
  };

  const totalItemCount = cart?.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const hasUnavailableItems = Boolean(
    cart?.items && cart.items.some((i) => i.availability === 'UNAVAILABLE'),
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PurchaseSteps current={2} />
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
            Thông tin giao hàng và thanh toán
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight flex items-center gap-3">
            <span>Hoàn tất đơn hàng</span>
            {totalItemCount > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary/25 font-medium">
                {totalItemCount} sản phẩm
              </span>
            )}
          </h1>
        </div>
        <Link
          href="/cart"
          className="text-xs text-subtle hover:text-ink flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <span>← Quay lại Giỏ hàng</span>
        </Link>
      </div>

      {/* 3 Network States: Loading -> Error -> Success */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : currentUser.role !== 'CUSTOMER' ? (
        <EmptyState
          title="Bạn đang ở vai trò khác"
          description={`Hiện tại bạn đang ở vai trò "${currentUser.name}" (${currentUser.badge}). Quy trình thanh toán đơn hàng dành riêng cho Khách mua sắm (Customer).`}
          actionText="Chuyển sang Khách hàng C để thanh toán"
          onAction={() => {
            const customerAcc = DEMO_ACCOUNTS.find((a) => a.role === 'CUSTOMER') || DEMO_ACCOUNTS[0];
            switchAccount(customerAcc);
          }}
        />
      ) : error ? (
        <ErrorFallback
          title="Không thể tải dữ liệu thanh toán"
          message={error}
          onRetry={fetchCart}
        />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          title="Không có sản phẩm nào để thanh toán"
          description="Giỏ hàng của bạn đang trống. Vui lòng chọn sản phẩm vào giỏ trước khi tiến hành thanh toán."
          actionText="Đến trang mua sắm"
          actionHref="/catalog"
        />
      ) : (
        /* Main Checkout Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left 2 Cols: Shipping Form & Dropshipping Parcel Split Preview */}
          <div className="lg:col-span-2 space-y-6">
            <ShippingForm
              errors={fieldErrors}
              onSubmit={handleCheckout}
              data={formData}
              onChange={handleFormChange}
              disabled={submitting}
            />

            <SplitOrderPreview
              items={cart.items.map((item) => ({
                listingId: item.listingId,
                title: item.title,
                quantity: item.quantity,
                unitSalePrice: item.unitSalePrice,
                supplierId: listingOwners[item.listingId]?.supplierId,
                sellerId: listingOwners[item.listingId]?.sellerId,
                supplierName: listingOwners[item.listingId]?.supplierName,
              }))}
            />
          </div>

          {/* Right Col: Summary Card */}
          <OrderSummaryCard
            totalItems={totalItemCount}
            subtotal={cart.estimatedMerchandiseTotal}
            hasUnavailableItems={hasUnavailableItems}
            onCheckout={handleCheckout}
            isLoading={submitting}
          />
        </div>
      )}
    </div>
  );
}
