'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
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
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
            <span>📦 Đơn Hàng Cần Xử Lý</span>
            <Badge variant="info" className="text-xs">
              Nhà Cung Cấp
            </Badge>
          </h1>
          <p className="text-xs text-subtle mt-1">
            Quản lý các kiện hàng phân bổ (Fulfillment Orders) từ khách mua trên toàn sàn
          </p>
        </div>

        <button
          onClick={fetchSupplierOrders}
          className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto cursor-pointer"
        >
          🔄 Làm mới danh sách
        </button>
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
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.key
                ? 'bg-primary text-white font-bold'
                : 'text-subtle hover:bg-slate-100'
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
                    <div className="text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-line font-mono">
                      <span className="text-subtle">Vận đơn: </span>
                      <span className="font-bold text-primary">{order.trackingNo}</span>
                      <span className="text-slate-400"> ({order.carrierCode})</span>
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
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-line/60 text-xs"
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
                  <div className="space-y-3 text-xs bg-slate-50/50 p-4 rounded-xl border border-line">
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
                      <div className="text-slate-600 leading-relaxed">
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
                      <button
                        type="button"
                        onClick={() => handleRejectOrder(order.fulfillmentOrderId)}
                        disabled={isLoadingThis}
                        className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        ✕ Từ chối đơn (Hết hàng)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptOrder(order.fulfillmentOrderId)}
                        disabled={isLoadingThis}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isLoadingThis ? 'Đang xử lý...' : '✓ Tiếp nhận đơn hàng'}
                      </button>
                    </>
                  )}

                  {order.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      onClick={() => handleShipOrder(order.fulfillmentOrderId)}
                      disabled={isLoadingThis}
                      className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingThis ? 'Đang tạo vận đơn...' : '🚚 Giao cho bưu tá (GHN Express)'}
                    </button>
                  )}

                  {(order.status === 'SHIPPED' || order.status === 'IN_TRANSIT') && (
                    <button
                      type="button"
                      onClick={() => handleDeliverOrder(order.fulfillmentOrderId)}
                      disabled={isLoadingThis}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingThis ? 'Đang xác nhận...' : '📦 Xác nhận giao hàng thành công'}
                    </button>
                  )}

                  {order.status === 'DELIVERED' && (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                      <span>✓</span>
                      <span>Đã hoàn tất giao hàng</span>
                    </span>
                  )}

                  {order.status === 'REJECTED' && (
                    <span className="text-xs text-rose-600 font-bold flex items-center gap-1.5">
                      <span>✕</span>
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
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

