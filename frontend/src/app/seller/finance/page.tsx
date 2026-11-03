'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { PriceDisplay } from '../../../components/molecules/price-display';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/molecules/empty-state';

interface SellerSettlementItem {
  settlementId: string;
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  orderNo: string;
  status: 'HOLD' | 'ELIGIBLE' | 'CALCULATED' | 'PAYOUT_PENDING' | 'PAID' | 'REVERSED';
  grossSaleAmount: number;
  sellerEarning: number;
  platformFee: number;
  currency: string;
  eligibleAt?: string;
  hasOpenDispute: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DoubleEntryLeg {
  id: string;
  settlementId: string;
  fulfillmentOrderId: string;
  transactionGroupRef: string;
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amountVnd: number;
  currency: string;
  sourceRef: string;
  description: string;
  postedAt: string;
}

interface SellerFinanceResponse {
  role: string;
  sellerProfileId: string;
  summary: {
    holdingAmount: number;
    eligibleAmount: number;
    paidAmount: number;
    reversedCount: number;
    displayName: string;
    shopName: string;
  };
  settlements: SellerSettlementItem[];
  ledgerEntries: DoubleEntryLeg[];
}

export default function SellerFinancePage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<SellerFinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchSellerFinance = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.get<SellerFinanceResponse>('/seller/finance');
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'Không thể tải báo cáo lợi nhuận Người bán', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerFinance();
  }, [currentUser]);

  const handleFastForwardEligible = async (settlementId: string) => {
    try {
      setActionId(settlementId);
      await ApiClient.post(`/settlements/${settlementId}/evaluate`, {
        fastForwardDemo: true,
        sourceRef: `seller_eval_${settlementId}_${Date.now()}`,
      });
      showToast('Đã qua 7 ngày đổi trả! Hoa hồng đơn hàng đã sẵn sàng rút (ELIGIBLE).', 'success');
      await fetchSellerFinance();
    } catch (err: any) {
      showToast(err.message || 'Chưa đủ điều kiện mở khóa đối soát', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handlePayout = async (settlementId: string) => {
    try {
      setActionId(settlementId);
      await ApiClient.post(`/settlements/${settlementId}/payout`, {
        sourceRef: `payout_${settlementId}`,
      });
      showToast('Đã rút hoa hồng thành công! Sổ cái đã cập nhật tất toán.', 'success');
      await fetchSellerFinance();
    } catch (err: any) {
      showToast(err.message || 'Giải ngân thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const renderStatusBadge = (item: SellerSettlementItem) => {
    if (item.status === 'HOLD' && item.hasOpenDispute) {
      return <Badge variant="destructive">🔒 Đóng băng (Khách đang khiếu nại)</Badge>;
    }
    switch (item.status) {
      case 'HOLD':
        return <Badge variant="warning">⏳ Tạm giữ (7 ngày bảo vệ người mua)</Badge>;
      case 'ELIGIBLE':
      case 'CALCULATED':
        return <Badge variant="info">✅ Sẵn sàng rút hoa hồng</Badge>;
      case 'PAYOUT_PENDING':
        return <Badge variant="warning">🔄 Đang chi trả</Badge>;
      case 'PAID':
        return <Badge variant="success">💸 Đã nhận hoa hồng</Badge>;
      case 'REVERSED':
        return <Badge variant="destructive">↩️ Hoàn tiền khách / Đảo lợi nhuận</Badge>;
      default:
        return <Badge variant="secondary">{item.status}</Badge>;
    }
  };

  if (currentUser.role !== 'SELLER' && currentUser.role !== 'ADMIN') {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto my-8 space-y-3 border border-line">
        <h2 className="text-lg font-bold text-ink">Khu vực dành cho Người bán (Seller)</h2>
        <p className="text-sm text-subtle">
          Vui lòng chọn tài khoản <strong>Seller X (TechStore)</strong> ở góc phải trên cùng màn hình để theo dõi lợi nhuận bán hàng Dropshipping và lịch sử rút tiền.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              💰 Doanh Thu & Hoa Hồng Gian Hàng
            </h1>
            <Badge variant="default">Seller Finance</Badge>
          </div>
          <p className="text-xs text-subtle mt-1">
            Gian hàng: <strong>{data?.summary.shopName || 'TechStore'}</strong> • Chủ shop:{' '}
            {data?.summary.displayName || currentUser.name}
          </p>
        </div>

        <button
          onClick={fetchSellerFinance}
          className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
        >
          🔄 Làm mới doanh thu
        </button>
      </div>

      {/* Summary KPIs */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border border-line bg-surface space-y-1.5">
            <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
              Lợi nhuận chờ đối soát (HOLD)
            </span>
            <div className="text-2xl font-bold text-amber-700">
              <PriceDisplay amount={data.summary.holdingAmount} />
            </div>
            <p className="text-xs text-subtle">
              Chờ qua 7 ngày đổi trả kể từ khi đơn giao thành công
            </p>
          </Card>

          <Card className="p-5 border border-line bg-surface space-y-1.5">
            <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
              Lợi nhuận khả dụng (ELIGIBLE)
            </span>
            <div className="text-2xl font-bold text-sky-700">
              <PriceDisplay amount={data.summary.eligibleAmount} />
            </div>
            <p className="text-xs text-subtle">
              Có thể yêu cầu rút tiền về ví / ngân hàng ngay
            </p>
          </Card>

          <Card className="p-5 border border-line bg-surface space-y-1.5">
            <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
              Lợi nhuận đã nhận (PAID)
            </span>
            <div className="text-2xl font-bold text-primary">
              <PriceDisplay amount={data.summary.paidAmount} />
            </div>
            <p className="text-xs text-subtle">
              Tổng tiền lãi ròng đã tất toán ({data.summary.reversedCount} đơn hoàn trả)
            </p>
          </Card>
        </div>
      ) : null}

      {/* Seller Settlements */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Chi Tiết Lợi Nhuận Theo Kiện Hàng Đã Giao</h2>
          <span className="text-xs text-subtle">Bảo mật dữ liệu theo vai trò Seller</span>
        </div>

        {loading ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : !data || data.settlements.length === 0 ? (
          <EmptyState
            title="Chưa có khoản hoa hồng nào"
            description="Khi Nhà cung cấp giao đơn hàng của Shop bạn tới tay khách hàng (DELIVERED), lợi nhuận ròng của bạn sẽ được ghi nhận tại đây."
          />
        ) : (
          <div className="space-y-4">
            {data.settlements.map((item) => {
              const isBusy = actionId === item.settlementId;
              return (
                <Card key={item.settlementId} className="p-5 border border-line space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-ink">
                          {item.fulfillmentNo}
                        </span>
                        <span className="text-xs text-subtle">• Đơn khách: {item.orderNo}</span>
                        {renderStatusBadge(item)}
                      </div>
                      <p className="text-xs text-subtle">
                        Doanh thu bán lẻ:{' '}
                        <strong className="text-ink">
                          <PriceDisplay amount={item.grossSaleAmount} />
                        </strong>{' '}
                        • Phí nền tảng:{' '}
                        <strong className="text-ink">
                          <PriceDisplay amount={item.platformFee} />
                        </strong>
                      </p>
                      <p className="text-xs text-subtle">
                        Ngày đủ điều kiện đối soát:{' '}
                        <span className="font-medium text-ink">
                          {item.eligibleAt
                            ? new Date(item.eligibleAt).toLocaleString('vi-VN')
                            : '—'}
                        </span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-subtle block">Lợi nhuận ròng Seller nhận</span>
                      <span className="text-lg font-bold text-primary">
                        <PriceDisplay amount={item.sellerEarning} />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-subtle font-mono">
                      Mã đối soát: {item.settlementId}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === 'HOLD' && !item.hasOpenDispute && (
                        <button
                          onClick={() => handleFastForwardEligible(item.settlementId)}
                          disabled={isBusy}
                          className="px-3.5 py-2 rounded-xl border border-line bg-primary-soft text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                        >
                          {isBusy ? 'Đang xử lý...' : '⏩ Mô phỏng qua 7 ngày đổi trả'}
                        </button>
                      )}

                      {(item.status === 'ELIGIBLE' ||
                        item.status === 'CALCULATED' ||
                        item.status === 'PAYOUT_PENDING') && (
                        <button
                          onClick={() => handlePayout(item.settlementId)}
                          disabled={isBusy}
                          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                          {isBusy ? 'Đang rút tiền...' : '💸 Rút hoa hồng (Mock Payout)'}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Seller Ledger */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">📒 Bút Toán Lợi Nhuận Seller (SELLER_PAYABLE)</h2>
          <p className="text-xs text-subtle">
            Trích lục sổ cái kế toán kép cho tài khoản công nợ hoa hồng của Gian hàng.
          </p>
        </div>

        {!data || data.ledgerEntries.length === 0 ? (
          <Card className="p-6 text-center text-xs text-subtle border border-line">
            Chưa có bút toán lợi nhuận nào.
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-subtle border-b border-line">
                <tr>
                  <th className="py-3 px-4 font-semibold">Thời gian</th>
                  <th className="py-3 px-4 font-semibold">Mã Group</th>
                  <th className="py-3 px-4 font-semibold">Vế kế toán</th>
                  <th className="py-3 px-4 font-semibold text-right">Số tiền (VND)</th>
                  <th className="py-3 px-4 font-semibold">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.ledgerEntries.map((leg) => (
                  <tr key={leg.id} className="hover:bg-muted/40">
                    <td className="py-3 px-4 whitespace-nowrap text-subtle">
                      {new Date(leg.postedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-ink">
                      {leg.transactionGroupRef}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={leg.direction === 'CREDIT' ? 'success' : 'warning'}>
                        {leg.direction === 'CREDIT' ? 'CREDIT (+ Cộng ví)' : 'DEBIT (- Tất toán/Đảo)'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular text-ink">
                      <PriceDisplay amount={leg.amountVnd} />
                    </td>
                    <td className="py-3 px-4 text-subtle">{leg.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {toast && (
        <div role="status" className="toast">
          {toast.type === 'error' ? '❌ ' : '✅ '}
          {toast.message}
        </div>
      )}
    </div>
  );
}

