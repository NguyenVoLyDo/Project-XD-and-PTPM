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

interface OrderItemInfo {
  fulfillmentItemId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  unitSalePrice: number;
  itemGross: number;
}

interface SupplierFulfillmentOrder {
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
    phone?: string;
    address?: string;
    city?: string;
    line1?: string;
    wardCode?: string;
    provinceCode?: string;
  };
  items: OrderItemInfo[];
  createdAt: string;
  updatedAt?: string;
}

export default function SupplierOrdersPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<SupplierFulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSupplierOrders = async () => {
    try {
      setLoading(true);
      const res: any = await ApiClient.get('/supplier/orders');
      setOrders(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.warn('Fetch supplier orders error:', err);
      showToast(err.message || 'Không thể tải danh sách đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierOrders();
  }, [currentUser]);

  // 1. Nhận đơn hàng (Accept)
  const handleAcceptOrder = async (foId: string) => {
    try {
      setActionLoadingId(foId);
      await ApiClient.post(`/supplier/orders/${foId}/accept`);
      showToast('Đã tiếp nhận đơn hàng! Tồn kho đã được chốt (COMMITTED).', 'success');
      await fetchSupplierOrders();
    } catch (err: any) {
      showToast(err.message || 'Tiếp nhận đơn hàng thất bại', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Giao cho bên vận chuyển (Ship)
  const handleShipOrder = async (foId: string) => {
    try {
      setActionLoadingId(foId);
      const trackingNo = `GHN-${Date.now().toString().slice(-8)}`;
      await ApiClient.post(`/supplier/orders/${foId}/ship`, {
        carrierCode: 'GHN_EXPRESS',
        trackingNo,
      });
      showToast(`Đã bàn giao cho GHN Express! Mã vận đơn: ${trackingNo}`, 'success');
      await fetchSupplierOrders();
    } catch (err: any) {
      showToast(err.message || 'Bàn giao vận chuyển thất bại', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Giao hàng thành công (Deliver)
  const handleDeliverOrder = async (foId: string) => {
    try {
      setActionLoadingId(foId);
      await ApiClient.post(`/supplier/orders/${foId}/deliver`);
      showToast('Đã xác nhận giao hàng thành công tới khách hàng!', 'success');
      await fetchSupplierOrders();
    } catch (err: any) {
      showToast(err.message || 'Xác nhận giao hàng thất bại', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Từ chối đơn hàng (Reject)
  const handleRejectOrder = async (foId: string) => {
    if (!confirm('Bạn có chắc chắn muốn từ chối đơn hàng này do hết hàng không? Hệ thống sẽ tự động hoàn tiền cho khách.')) {
      return;
    }
    try {
      setActionLoadingId(foId);
      await ApiClient.post(`/supplier/orders/${foId}/reject`, { reasonCode: 'OUT_OF_STOCK' });
      showToast('Đã từ chối đơn hàng và kích hoạt hoàn tiền tự động.', 'success');
      await fetchSupplierOrders();
    } catch (err: any) {
      showToast(err.message || 'Từ chối đơn hàng thất bại', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Lọc theo tab
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return o.status === 'PENDING_ACCEPTANCE';
    if (activeTab === 'ACCEPTED') return o.status === 'ACCEPTED' || o.status === 'PACKING';
    if (activeTab === 'SHIPPED') return o.status === 'SHIPPED' || o.status === 'IN_TRANSIT';
    if (activeTab === 'DELIVERED') return o.status === 'DELIVERED';
    if (activeTab === 'REJECTED') return o.status === 'REJECTED' || o.status === 'CANCELED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle bg-surface border border-line px-2.5 py-1 rounded-full mb-2">
            Supplier Portal
          </span>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Đơn Hàng Cần Xử Lý
          </h1>
          <p className="text-sm text-subtle mt-1">
            Quản lý các kiện hàng phân bổ (Fulfillment Orders) từ khách mua trên toàn sàn
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSupplierOrders}
          className="self-start sm:self-auto"
        >
          <Icon name="refresh" className="w-3.5 h-3.5 mr-1.5" />
          Làm mới danh sách
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line text-xs font-medium">
        {[
          { key: 'ALL', label: `Tất cả (${orders.length})` },
          { key: 'PENDING', label: `Chờ tiếp nhận (${orders.filter((o) => o.status === 'PENDING_ACCEPTANCE').length})` },
          { key: 'ACCEPTED', label: `Đang đóng gói (${orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PACKING').length})` },
          { key: 'SHIPPED', label: `Đang giao (${orders.filter((o) => o.status === 'SHIPPED' || o.status === 'IN_TRANSIT').length})` },
          { key: 'DELIVERED', label: `Đã giao (${orders.filter((o) => o.status === 'DELIVERED').length})` },
          { key: 'REJECTED', label: `Đã từ chối (${orders.filter((o) => o.status === 'REJECTED').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.key
                ? 'bg-ink text-white font-semibold'
                : 'bg-surface border border-line text-subtle hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon="orders"
          title="Không có đơn hàng nào"
          description="Hiện tại chưa có đơn hàng nào ở trạng thái này."
        />
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const isLoadingThis = actionLoadingId === order.fulfillmentOrderId;
            return (
              <Card key={order.fulfillmentOrderId} className="p-6 space-y-4 border border-line">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-ink text-sm">
                        Mã kiện: {order.fulfillmentNo}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-xs text-subtle">
                      Đơn hàng gốc: <span className="font-semibold text-ink">#{order.orderNo}</span> • Ngày đặt:{' '}
                      {(() => {
                        try {
                          return new Date(order.createdAt).toLocaleString('vi-VN');
                        } catch {
                          return order.createdAt;
                        }
                      })()}
                    </div>
                  </div>

                  {order.trackingNo && (
                    <div className="text-xs bg-canvas px-3 py-1.5 rounded-lg border border-line font-mono flex items-center gap-1.5">
                      <Icon name="truck" className="w-3.5 h-3.5 text-subtle" />
                      <span className="text-subtle">Vận đơn: </span>
                      <span className="font-bold text-ink">{order.trackingNo}</span>
                      <span className="text-subtle"> ({order.carrierCode})</span>
                    </div>
                  )}
                </div>

                {/* Items & Shipping address grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 cols: Products in this parcel */}
                  <div className="lg:col-span-2 space-y-3">
                    <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                      Sản phẩm trong kiện hàng:
                    </span>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={item.fulfillmentItemId || idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-ink">{item.productName}</div>
                            <div className="text-subtle">
                              Số lượng: <span className="font-semibold text-ink">{item.quantity}</span>
                            </div>
                          </div>
                          <PriceDisplay amount={item.itemGross || item.unitSalePrice * item.quantity} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right col: Recipient info & Settlement amount */}
                  <div className="space-y-3 text-xs bg-canvas p-4 rounded-xl border border-line">
                    <span className="font-bold text-subtle uppercase tracking-wider">
                      Địa chỉ nhận hàng:
                    </span>
                    <div className="space-y-1">
                      <div className="font-bold text-ink">
                        {order.shippingAddress?.recipientName || 'Khách hàng'}
                      </div>
                      <div className="text-subtle font-mono">
                        {order.shippingAddress?.phone || '09xx-xxx-xxx'}
                      </div>
                      <div className="text-subtle leading-relaxed">
                        {order.shippingAddress?.line1 || order.shippingAddress?.address || 'Việt Nam'}
                        {order.shippingAddress?.city && `, ${order.shippingAddress.city}`}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-line flex items-baseline justify-between">
                      <span className="font-semibold text-subtle">Khoản phân bổ thu:</span>
                      <PriceDisplay amount={order.amountToCollect} size="md" />
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pt-3 border-t border-line flex flex-wrap items-center justify-end gap-3">
                  {order.status === 'PENDING_ACCEPTANCE' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRejectOrder(order.fulfillmentOrderId)}
                        disabled={isLoadingThis}
                        className="text-danger border-danger/30 hover:bg-danger-soft"
                      >
                        <Icon name="close" className="w-3.5 h-3.5 mr-1" />
                        Từ chối đơn (Hết hàng)
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleAcceptOrder(order.fulfillmentOrderId)}
                        disabled={isLoadingThis}
                      >
                        <Icon name="check" className="w-3.5 h-3.5 mr-1" />
                        {isLoadingThis ? 'Đang xử lý...' : 'Tiếp nhận đơn hàng'}
                      </Button>
                    </>
                  )}

                  {order.status === 'ACCEPTED' && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleShipOrder(order.fulfillmentOrderId)}
                      disabled={isLoadingThis}
                    >
                      <Icon name="truck" className="w-3.5 h-3.5 mr-1.5" />
                      {isLoadingThis ? 'Đang tạo vận đơn...' : 'Giao cho bưu tá (GHN Express)'}
                    </Button>
                  )}

                  {(order.status === 'SHIPPED' || order.status === 'IN_TRANSIT') && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleDeliverOrder(order.fulfillmentOrderId)}
                      disabled={isLoadingThis}
                    >
                      <Icon name="check" className="w-3.5 h-3.5 mr-1.5" />
                      {isLoadingThis ? 'Đang xác nhận...' : 'Xác nhận giao hàng thành công'}
                    </Button>
                  )}

                  {order.status === 'DELIVERED' && (
                    <span className="text-xs text-success font-bold flex items-center gap-1.5">
                      <Icon name="check" className="w-3.5 h-3.5" />
                      <span>Đã hoàn tất giao hàng</span>
                    </span>
                  )}

                  {order.status === 'REJECTED' && (
                    <span className="text-xs text-danger font-bold flex items-center gap-1.5">
                      <Icon name="close" className="w-3.5 h-3.5" />
                      <span>Đã từ chối đơn hàng (Đã kích hoạt hoàn tiền)</span>
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-danger-soft text-danger border-danger/30'
              : 'bg-surface text-ink border-line'
          }`}
        >
          <Icon name={toast.type === 'error' ? 'alert' : 'check'} className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
