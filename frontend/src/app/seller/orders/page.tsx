'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { StatusBadge } from '../../../components/molecules/status-badge';
import { PriceDisplay } from '../../../components/molecules/price-display';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/molecules/empty-state';
import { ErrorFallback } from '../../../components/molecules/error-fallback';

interface OrderItemInfo {
  fulfillmentItemId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  unitSalePrice: number;
  itemGross: number;
}

interface SellerFulfillmentOrder {
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  customerOrderId: string;
  orderNo: string;
  status: string;
  carrierCode?: string;
  trackingNo?: string;
  amountToCollect: number;
  paymentStatus: string;
  shippingAddress?: {
    recipientName?: string;
    city?: string;
    provinceCode?: string;
  } | null;
  items: OrderItemInfo[];
  createdAt: string;
  updatedAt?: string;
}

export default function SellerOrdersPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<SellerFulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const fetchSellerOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await ApiClient.get('/seller/orders');
      setOrders(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.warn('Fetch seller orders error:', err);
      setError(err.message || 'Không thể tải danh sách đơn hàng của gian hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerOrders();
  }, [currentUser]);

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return ['PENDING_ACCEPTANCE', 'PENDING', 'ACCEPTED', 'PACKING', 'READY_TO_SHIP'].includes(o.status);
    if (activeTab === 'SHIPPED') return ['SHIPPED', 'IN_TRANSIT'].includes(o.status);
    if (activeTab === 'DELIVERED') return o.status === 'DELIVERED';
    if (activeTab === 'CANCELED') return ['REJECTED', 'CANCELED'].includes(o.status);
    return true;
  });

  const totalRevenue = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + (o.amountToCollect || 0), 0);
  const deliveringCount = orders.filter((o) => ['SHIPPED', 'IN_TRANSIT'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Đơn Hàng Bán Lẻ</h1>
          <p className="text-xs text-subtle mt-1">
            Theo dõi trạng thái đóng gói, vận chuyển và dòng tiền thu hộ của các sản phẩm thuộc gian hàng bạn.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSellerOrders}
          disabled={loading}
          className="text-xs font-semibold self-start sm:self-auto"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-5 border border-line bg-surface">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng đơn bán lẻ</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle">
              <Icon name="receipt" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-ink mt-2">{orders.length}</div>
          <div className="text-[11px] text-subtle mt-1">Đơn tách từ giỏ hàng</div>
        </Card>

        <Card className="p-4 sm:p-5 border border-line bg-surface">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Đang vận chuyển</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle">
              <Icon name="truck" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-ink mt-2">{deliveringCount}</div>
          <div className="text-[11px] text-subtle mt-1">Đang giao đến khách</div>
        </Card>

        <Card className="p-4 sm:p-5 border border-line bg-surface">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Đã giao thành công</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle">
              <Icon name="check" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-ink mt-2">{deliveredCount}</div>
          <div className="text-[11px] text-subtle mt-1">Chờ 7 ngày đối soát ví</div>
        </Card>

        <Card className="p-4 sm:p-5 border border-line bg-surface">
          <div className="flex items-center justify-between text-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Doanh số hoàn tất</span>
            <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle">
              <Icon name="wallet" width={15} height={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-ink mt-2">
            <PriceDisplay amount={totalRevenue} />
          </div>
          <div className="text-[11px] text-subtle mt-1">Giá trị đơn đã giao</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-line pb-2 overflow-x-auto text-xs">
        {[
          { key: 'ALL', label: 'Tất cả đơn' },
          { key: 'PENDING', label: 'Chờ đóng gói & Giao' },
          { key: 'SHIPPED', label: 'Đang vận chuyển' },
          { key: 'DELIVERED', label: 'Đã giao thành công' },
          { key: 'CANCELED', label: 'Từ chối / Hủy' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'bg-ink text-white'
                : 'text-subtle hover:text-ink hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="p-6 space-y-4 border border-line">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorFallback
          title="Không thể tải danh sách đơn hàng"
          message={error}
          onRetry={fetchSellerOrders}
        />
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <EmptyState
          title="Chưa có đơn hàng nào"
          description="Hiện tại gian hàng của bạn chưa phát sinh đơn hàng bán lẻ trong danh mục này."
          actionText="Tìm nguồn hàng để niêm yết thêm"
          actionHref="/seller/sourcing"
        />
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card
              key={order.fulfillmentOrderId}
              className="p-5 border border-line bg-surface hover:border-line transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-line gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-ink">
                      {order.fulfillmentNo}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono text-subtle">
                      Đơn gốc: {order.orderNo}
                    </Badge>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-xs text-subtle">
                    Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {order.trackingNo && (
                    <div className="text-xs bg-canvas border border-line px-2.5 py-1 rounded-lg">
                      <span className="text-subtle mr-1">Vận đơn:</span>
                      <span className="font-mono font-medium text-ink">{order.trackingNo}</span>
                      <span className="ml-1 text-[10px] text-subtle font-semibold uppercase">
                        ({order.carrierCode || 'GHN'})
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <div className="text-xs text-subtle">Thu hộ COD / Tiền hàng</div>
                    <div className="text-base font-bold text-ink">
                      <PriceDisplay amount={order.amountToCollect} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-3 divide-y divide-line">
                {order.items.map((item) => (
                  <div
                    key={item.fulfillmentItemId}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{item.productName}</span>
                      <span className="text-subtle">x{item.quantity}</span>
                    </div>
                    <div className="font-mono text-ink">
                      <PriceDisplay amount={item.itemGross || item.unitSalePrice * item.quantity} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between text-xs text-subtle gap-2">
                <div>
                  Khu vực giao hàng:{' '}
                  <span className="text-ink font-medium">
                    {order.shippingAddress?.city || 'Đã ẩn thông tin định danh cá nhân (NFR-06)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Trạng thái thanh toán:</span>
                  <StatusBadge status={order.paymentStatus} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
