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
import { LoginModal } from '../../../components/modals/login-modal';

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
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const requestId = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

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
      {loginModalOpen && (
        <LoginModal
          actionMessage="Đăng nhập tài khoản để xem và theo dõi đơn mua của bạn"
          redirectUrl="/orders"
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => {
            setLoginModalOpen(false);
            fetchOrders();
          }}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-2.5">
            <span>Đơn hàng của bạn</span>
            {orders.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary font-semibold">
                {pagination.total} đơn
              </span>
            )}
          </h1>
          <p className="text-xs text-subtle mt-1">Tra cứu trạng thái xử lý và vận chuyển từng kiện hàng</p>
        </div>

        <Link href="/catalog">
          <Button variant="outline" size="sm" className="font-semibold text-xs">
            <span>Khám phá thêm sản phẩm</span>
          </Button>
        </Link>
      </div>

      {/* Tabs - Modern Clean Underline Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none border-b border-line">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-subtle hover:text-ink hover:border-line'
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
      ) : !currentUser.id ? (
        <EmptyState
          title="Vui lòng đăng nhập để xem đơn hàng"
          description="Đăng nhập tài khoản khách hàng để tra cứu lịch sử mua sắm và theo dõi tình trạng giao hàng các kiện hàng của bạn."
          actionText="Đăng nhập ngay"
          actionHref="/login?redirect=/orders"
          onAction={() => setLoginModalOpen(true)}
        />
      ) : currentUser.role !== 'CUSTOMER' ? (
        <EmptyState
          title="Bạn đang ở vai trò khác"
          description={`Hiện tại bạn đang ở vai trò "${currentUser.name}" (${currentUser.badge}). Quản lý đơn hàng mua sắm dành riêng cho Khách mua sắm (Customer).`}
          actionText="Chuyển sang vai trò Khách hàng"
          onAction={() => {
            const customerAcc = DEMO_ACCOUNTS.find((a) => a.role === 'CUSTOMER') || DEMO_ACCOUNTS[0];
            switchAccount(customerAcc).catch(error => showToast(error.message, 'error'));
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
