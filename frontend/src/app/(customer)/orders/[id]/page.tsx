'use client';

import React, { useState, useEffect } from 'react';
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
import { Separator } from '../../../../components/ui/separator';
import { Skeleton } from '../../../../components/ui/skeleton';

interface FulfillmentItemDetail {
  orderItemId: string;
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

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrderDetail = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);
      const data: any = await ApiClient.get(`/orders/${orderId}`);
      setOrder(data);
    } catch (err: any) {
      console.warn('Load order detail error:', err.message);
      setError(err.message || 'Không thể tải thông tin chi tiết đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

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
          className="text-xs text-subtle hover:text-ink flex items-center gap-1.5 transition self-start sm:self-auto"
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
            <h3 className="text-xs font-bold text-subtle ">
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
                      items={parcel.items || []}
                      trackingNo={parcel.trackingNo}
                      carrierCode={parcel.carrierCode}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Address & Payment Summary */}
            <div className="space-y-6">
              {/* Shipping Address Card */}
              <Card className="p-5 space-y-4">
                <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
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
                  <svg aria-hidden="true" className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
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
                    <span className="text-emerald-700 font-semibold">Miễn phí</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-bold text-ink text-sm">Tổng thanh toán:</span>
                    <PriceDisplay amount={order.totalPayable} size="lg" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
