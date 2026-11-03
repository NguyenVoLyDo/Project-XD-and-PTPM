'use client';

import React, { useState, useEffect } from 'react';
import { useAuth as useIdentity } from '../../../../features/auth/hooks/use-auth';
import { useAuth as useDemoAuth } from '../../../../lib/auth-context';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ApiClient } from '../../../../lib/api';
import { FulfillmentParcelCard } from '../../../../components/organisms/order/fulfillment-parcel-card';
import { StatusBadge } from '../../../../components/molecules/status-badge';
import { PriceDisplay } from '../../../../components/molecules/price-display';
import { OrderStepper, StepItem } from '../../../../components/molecules/order-stepper';
import { ErrorFallback } from '../../../../components/molecules/error-fallback';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Icon } from '../../../../components/ui/icon';
import { Separator } from '../../../../components/ui/separator';
import { Skeleton } from '../../../../components/ui/skeleton';

interface FulfillmentItemDetail {
  orderItemId: string;
  fulfillmentOrderId: string;
  listingId: string;
  productName: string;
  quantity: number;
  unitSalePrice: number;
}

interface FulfillmentOrderDetail {
  fulfillmentOrderId: string;
  supplierId: string;
  status: string;
  amountToCollect: number;
  items: FulfillmentItemDetail[];
  trackingNo?: string;
  carrierCode?: string;
  updatedAt?: string;
}

interface OrderDetail {
  items: FulfillmentItemDetail[];
  orderId: string;
  orderNo: string;
  customerId: string;
  status: string;
  fulfillmentSummary: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  grandTotal: number;
  totalPayable: number;
  shippingAddress: {
    recipientName: string;
    phone: string;
    line1: string;
    wardCode: string;
    provinceCode: string;
  };
  fulfillmentOrders: FulfillmentOrderDetail[];
  createdAt: string;
  updatedAt?: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { actor, isLoading } = useIdentity();
  const { currentUser } = useDemoAuth();
  if (isLoading && process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED !== 'true') return <Skeleton className="h-56 w-full" />;
  const activeRole = actor?.activeRole || currentUser?.role;
  if (activeRole !== 'CUSTOMER') return <ErrorFallback title="Không có quyền truy cập" message="Vui lòng đăng nhập bằng tài khoản khách hàng." />;
  return <CustomerOrderDetail key={`${actor?.userId || currentUser?.id}:${activeRole}:${orderId}`} orderId={orderId} />;
}

function CustomerOrderDetail({ orderId }: { orderId: string }) {
  const [reload, setReload] = useState(0);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOrderDetail = () => setReload(value => value + 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setOrder(null);
    setError(null);
    ApiClient.get<OrderDetail>(`/orders/${orderId}`)
      .then(data => { if (active) setOrder(data); })
      .catch(err => { if (active) setError(err.message || 'Không thể tải thông tin chi tiết đơn hàng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, reload]);

  /**
   * Giả lập thanh toán trực tuyến qua VietQR (gọi Webhook sang Payments module)
   */
  const handleSimulatePayment = async () => {
    if (!order || paying) return;
    try {
      setPaying(true);
      await ApiClient.post('/payments/webhooks/vietqr', {
        provider: 'VIETQR',
        providerEventId: `evt_${Date.now()}`,
        providerTransactionRef: `VQR_${Date.now()}`,
        orderId: order.orderId,
        paymentId: order.orderId,
        amount: order.totalPayable,
        status: 'SUCCESS',
        signature: 'valid_mock_signature',
        timestamp: new Date().toISOString(),
      });
      showToast('Đã xác nhận thanh toán trực tuyến thành công!', 'success');
      await loadOrderDetail();
    } catch (err: any) {
      showToast(err.message || 'Mô phỏng thanh toán thất bại', 'error');
    } finally {
      setPaying(false);
    }
  };

  // Stepper calculations
  const steps: StepItem[] = React.useMemo(() => {
    if (!order) return [];
    return [
      { label: 'Đặt hàng thành công', active: true },
      {
        label: 'Xác nhận thanh toán',
        active: order.status !== 'PENDING_PAYMENT' && order.paymentStatus !== 'FAILED',
      },
      {
        label: 'NCC tiếp nhận & Đóng gói',
        active:
          ['CONFIRMED', 'PROCESSING', 'CLOSED'].includes(order.status) &&
          order.fulfillmentSummary !== 'UNFULFILLED',
      },
      {
        label: 'Đang vận chuyển',
        active:
          ['PROCESSING', 'CLOSED'].includes(order.status) &&
          ['FULFILLED', 'COMPLETED'].includes(order.fulfillmentSummary),
      },
      {
        label: 'Giao hàng thành công',
        active: order.fulfillmentSummary === 'COMPLETED' || order.status === 'CLOSED',
      },
    ];
  }, [order]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase mb-1">
            <Link href="/orders" className="hover:underline">
              Đơn hàng
            </Link>
            <span>/</span>
            <span>Chi tiết đơn hàng</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {order ? `Đơn hàng #${order.orderNo}` : 'Chi tiết đơn hàng'}
            </h1>
            {order && <StatusBadge status={order.status} />}
          </div>
          {order && (
            <div className="text-xs text-subtle mt-1">
              Thời gian đặt:{' '}
              {(() => {
                try {
                  return new Date(order.createdAt).toLocaleString('vi-VN');
                } catch {
                  return order.createdAt;
                }
              })()}
            </div>
          )}
        </div>

        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-ink font-semibold transition"
        >
          <span>← Quay lại danh sách đơn hàng</span>
        </Link>
      </div>

      {/* 3 Network States: Loading -> Error -> Success */}
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      ) : error || !order ? (
        <ErrorFallback
          title="Không tìm thấy đơn hàng"
          message={error || 'Đơn hàng không tồn tại hoặc bạn không có quyền truy cập.'}
          onRetry={loadOrderDetail}
        />
      ) : (
        /* Order Content */
        <div className="space-y-8">
          {/* Stepper Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xs font-bold text-subtle">
              Tiến trình xử lý đơn hàng:
            </h3>
            <OrderStepper steps={steps} />
          </Card>

          {/* Main Grid: Fulfillment Orders & Side Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left 2 Cols: Multi-supplier Split Fulfillment Parcels */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
                  <span>Các Kiện Hàng Phân Tách</span>
                  <Badge variant="info" className="text-xs py-0.5">
                    {order.fulfillmentOrders?.length || 1} kiện
                  </Badge>
                </h3>
                <span className="text-xs text-subtle hidden sm:inline">
                  Tự động điều phối theo Nhà cung cấp
                </span>
              </div>

              {!order.fulfillmentOrders || order.fulfillmentOrders.length === 0 ? (
                <Card className="p-6 text-center text-xs text-subtle">
                  Đơn hàng đang trong quá trình phân bổ kiện hàng tới Nhà cung cấp.
                </Card>
              ) : (
                <div className="space-y-4">
                  {order.fulfillmentOrders.map((parcel, idx) => (
                    <FulfillmentParcelCard
                      key={parcel.fulfillmentOrderId || idx}
                      index={idx + 1}
                      fulfillmentOrderId={parcel.fulfillmentOrderId}
                      supplierId={parcel.supplierId}
                      status={parcel.status}
                      amountToCollect={parcel.amountToCollect}
                      items={(order.items || []).filter(item => item.fulfillmentOrderId === parcel.fulfillmentOrderId)}
                      trackingNo={parcel.trackingNo}
                      carrierCode={parcel.carrierCode}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Address & Payment Summary & VietQR */}
            <div className="space-y-6">
              {/* Shipping Address Card */}
              <Card className="p-5 space-y-4">
                <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                  <Icon name="mapPin" className="w-4 h-4 text-subtle" />
                  <span>Địa Chỉ Nhận Hàng</span>
                </h4>

                <div className="text-xs space-y-1.5 text-ink">
                  <div className="font-bold text-ink text-sm">
                    {order.shippingAddress?.recipientName}
                  </div>
                  <div className="text-subtle font-mono">
                    {order.shippingAddress?.phone}
                  </div>
                  <div className="leading-relaxed">
                    {order.shippingAddress?.line1}
                    {order.shippingAddress?.wardCode && `, ${order.shippingAddress.wardCode}`}
                    {order.shippingAddress?.provinceCode && `, ${order.shippingAddress.provinceCode}`}
                  </div>
                </div>
              </Card>

              {/* Payment Summary Card */}
              <Card className="p-5 space-y-4">
                <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                  <Icon name="creditCard" className="w-4 h-4 text-subtle" />
                  <span>Thanh Toán & Hóa Đơn</span>
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-subtle">
                    <span>Hình thức:</span>
                    <span className="font-semibold text-ink">
                      {order.paymentMethod === 'COD' ? 'Tiền mặt khi nhận (COD)' : 'VietQR Trực tuyến'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-subtle">
                    <span>Trạng thái thanh toán:</span>
                    <StatusBadge status={order.paymentStatus} />
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between text-subtle">
                    <span>Tạm tính tiền hàng:</span>
                    <PriceDisplay amount={order.grandTotal} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-subtle">
                    <span>Phí vận chuyển:</span>
                    <span className="text-success font-semibold">Miễn phí giao hàng</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-bold text-ink text-sm">Tổng thanh toán:</span>
                    <PriceDisplay amount={order.totalPayable} size="lg" />
                  </div>
                </div>
              </Card>

              {/* VietQR Payment Card (Chỉ hiện khi khách chọn Thanh toán Online) */}
              {order.paymentMethod !== 'COD' && (
                order.paymentStatus === 'PENDING' || order.status === 'PENDING_PAYMENT' ? (
                  <Card className="p-5 space-y-4 border border-accent/30 bg-accent-soft/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">Quét Mã VietQR</span>
                        <Badge variant="warning" className="text-[10px]">Chờ quét mã</Badge>
                      </div>
                      <span className="text-[10px] font-mono text-subtle">Hạn giữ kho: 15 phút</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-line">
                      <div className="w-32 h-32 relative flex-shrink-0 bg-white p-1 border border-line rounded-lg shadow-sm flex items-center justify-center">
                        <img
                          src={`https://api.vietqr.io/image/970422-99998888-compact2.png?amount=${order.totalPayable}&addInfo=${order.orderNo}&accountName=DROPCONNECT%20ESCROW`}
                          alt="Mã VietQR"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="text-xs space-y-1.5 flex-1 w-full">
                        <div className="flex justify-between">
                          <span className="text-subtle">Ngân hàng:</span>
                          <span className="font-bold text-ink">MB Bank (Quân Đội)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-subtle">Số tài khoản:</span>
                          <span className="font-mono font-bold text-primary">99998888</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-subtle">Chủ TK:</span>
                          <span className="font-semibold text-ink">DROPCONNECT ESCROW</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-subtle">Số tiền:</span>
                          <span className="font-bold text-primary">
                            {new Intl.NumberFormat('vi-VN').format(order.totalPayable)} đ
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-subtle">Nội dung CK:</span>
                          <span className="font-mono font-bold text-ink bg-canvas px-1.5 py-0.5 rounded border border-line">
                            {order.orderNo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulatePayment}
                      disabled={paying}
                      className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {paying ? (
                        <span>Đang xử lý Webhook...</span>
                      ) : (
                        <>
                          <Icon name="check" className="w-4 h-4" />
                          <span>Xác nhận đã chuyển khoản (Mô phỏng thanh toán)</span>
                        </>
                      )}
                    </button>
                  </Card>
                ) : (
                  <Card className="p-4 border border-success/30 bg-success-soft flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      ✓
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-ink">Thanh toán Online thành công</div>
                      <div className="text-success text-[11px] font-medium">Đã xác nhận tiền về tài khoản ký quỹ VietQR</div>
                    </div>
                  </Card>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-danger-soft text-danger border-danger/30'
              : 'bg-success-soft text-success border-success/30'
          }`}
        >
          <Icon name={toast.type === 'error' ? 'alert' : 'check'} className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
