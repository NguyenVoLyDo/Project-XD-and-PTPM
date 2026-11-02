'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ApiClient } from '../../../lib/api';
import { useAuth, DEMO_ACCOUNTS } from '../../../lib/auth-context';
import { OrderCard } from '../../../components/organisms/order/order-card';
import { EmptyState } from '../../../components/molecules/empty-state';
import { ErrorFallback } from '../../../components/molecules/error-fallback';
import { Skeleton } from '../../../components/ui/skeleton';
import { Button } from '../../../components/ui/button';

interface OrderSummary {
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
  fulfillmentOrderCount?: number;
  itemCount?: number;
  createdAt: string;
}

type TabKey = 'ALL' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELED';

export default function CustomerOrdersPage() {
  const { currentUser, switchAccount } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const requestId = useRef(0);

  const fetchOrders = useCallback(async () => {
    const request = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const data: any = await ApiClient.get('/orders', { page, limit: 20 });
      if (request !== requestId.current) return;
      if (data && Array.isArray(data.items)) {
        setOrders(data.items);
        setPagination(data.pagination || { total: data.items.length, totalPages: 1 });
      } else if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      if (request !== requestId.current) return;
      console.warn('Fetch orders error:', err.message);
      setError(err.message || 'Không thể tải danh sách đơn hàng từ máy chủ.');
      setOrders([]);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => { setPage(1); }, [currentUser.id]);

  useEffect(() => {
    if (currentUser.role === 'CUSTOMER') {
      fetchOrders();
    } else {
      setLoading(false);
      setError(null);
    }
    return () => { requestId.current += 1; };
  }, [currentUser.id, currentUser.role, fetchOrders]);

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return o.status === 'PENDING_PAYMENT' || o.paymentStatus === 'PENDING';
    if (activeTab === 'CONFIRMED') return o.status === 'CONFIRMED';
    if (activeTab === 'PROCESSING') return o.status === 'PROCESSING' || o.fulfillmentSummary.includes('PARTIALLY');
    if (activeTab === 'COMPLETED') return o.status === 'CLOSED' || o.fulfillmentSummary === 'COMPLETED';
    if (activeTab === 'CANCELED') return o.status === 'CANCELED';
    return true;
  });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'ALL', label: 'Tất cả đơn' },
    { key: 'PENDING', label: 'Chờ thanh toán' },
    { key: 'CONFIRMED', label: 'Đã xác nhận' },
    { key: 'PROCESSING', label: 'Đang xử lý / Đóng gói' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELED', label: 'Đã hủy' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="text-xs text-primary font-semibold  mb-1">
            Lịch sử giao dịch & Đơn hàng
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight flex items-center gap-3">
            <span>Đơn Hàng Của Bạn</span>
            {orders.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary/25 font-medium">
                {pagination.total} đơn
              </span>
            )}
          </h1>
        </div>

        <Link href="/catalog">
          <Button variant="secondary" size="sm" className="font-semibold">
            <span>+ Đặt thêm sản phẩm</span>
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-line">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                isActive
                  ? 'bg-primary text-ink shadow-md'
                  : 'bg-canvas text-subtle hover:text-ink hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {currentUser.role === 'CUSTOMER' && pagination.totalPages > 1 && (
        <nav aria-label="Phân trang đơn hàng" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>Trang {page} / {pagination.totalPages} · Bộ lọc áp dụng cho trang hiện tại.</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Trang trước</Button>
            <Button variant="secondary" disabled={loading || page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Trang sau</Button>
          </div>
        </nav>
      )}

      {/* 3 Network States: Loading -> Error -> Success */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : currentUser.role !== 'CUSTOMER' ? (
        <EmptyState
          title="Bạn đang ở vai trò khác"
          description={`Hiện tại bạn đang ở vai trò "${currentUser.name}" (${currentUser.badge}). Quản lý đơn hàng mua sắm dành riêng cho Khách mua sắm (Customer).`}
          actionText="Chuyển sang vai trò Khách hàng"
          onAction={() => {
            const customerAcc = DEMO_ACCOUNTS.find((a) => a.role === 'CUSTOMER') || DEMO_ACCOUNTS[0];
            switchAccount(customerAcc).catch(error => window.alert(error.message));
          }}
        />
      ) : error ? (
        <ErrorFallback
          title="Không thể tải lịch sử đơn hàng"
          message={error}
          onRetry={fetchOrders}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'ALL'
              ? 'Bạn chưa có đơn hàng nào'
              : `Không có đơn hàng nào ở trạng thái "${tabs.find((t) => t.key === activeTab)?.label}"`
          }
          description="Khám phá ngay hàng trăm sản phẩm hấp dẫn được tuyển chọn từ các nhà cung cấp uy tín trên nền tảng."
          actionText="Khám phá sản phẩm"
          actionHref="/catalog"
        />
      ) : (
        /* Orders List */
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId}
              orderId={order.orderId}
              orderNo={order.orderNo}
              status={order.status}
              fulfillmentSummary={order.fulfillmentSummary}
              paymentMethod={order.paymentMethod}
              paymentStatus={order.paymentStatus}
              grandTotal={order.grandTotal}
              totalPayable={order.totalPayable}
              itemCount={order.itemCount || 1}
              fulfillmentOrderCount={order.fulfillmentOrderCount}
              createdAt={order.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
