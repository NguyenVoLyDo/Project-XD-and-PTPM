'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { PriceDisplay } from '../../../components/molecules/price-display';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/molecules/empty-state';

interface SupplierSettlementItem {
  settlementId: string;
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  orderNo: string;
  status: 'HOLD' | 'ELIGIBLE' | 'CALCULATED' | 'PAYOUT_PENDING' | 'PAID' | 'REVERSED';
  supplierPayable: number;
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

interface SupplierFinanceResponse {
  role: string;
  supplierProfileId: string;
  summary: {
    holdingAmount: number;
    eligibleAmount: number;
    paidAmount: number;
    reversedCount: number;
    payoutAccountRef: string;
    legalName: string;
  };
  settlements: SupplierSettlementItem[];
  ledgerEntries: DoubleEntryLeg[];
}

interface SupplierDisputeItem {
  returnRequestId: string;
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  orderNo: string;
  productName: string;
  reasonCode: string;
  description: string;
  status: string;
  returnTrackingNo?: string | null;
  refundAmount: number;
  createdAt: string;
}

export default function SupplierFinancePage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<SupplierFinanceResponse | null>(null);
  const [disputes, setDisputes] = useState<SupplierDisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const [finRes, dispRes] = await Promise.all([
        ApiClient.get<SupplierFinanceResponse>('/supplier/finance'),
        ApiClient.get<SupplierDisputeItem[]>('/supplier/disputes').catch(() => []),
      ]);
      setData(finRes);
      setDisputes(Array.isArray(dispRes) ? dispRes : []);
    } catch (err: any) {
      showToast(err.message || 'Không thể tải dữ liệu tài chính Nhà cung cấp', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [currentUser]);

  const handleFastForwardEligible = async (settlementId: string) => {
    try {
      setActionId(settlementId);
      await ApiClient.post(`/settlements/${settlementId}/evaluate`, {
        fastForwardDemo: true,
        sourceRef: `demo_eval_${settlementId}_${Date.now()}`,
      });
      showToast('Đã hết thời hạn 7 ngày đổi trả! Khoản đối soát đã chuyển sang Đủ điều kiện rút (ELIGIBLE).', 'success');
      await fetchFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Chưa đủ điều kiện mở khóa đối soát', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleExecutePayout = async (settlementId: string) => {
    try {
      setActionId(settlementId);
      await ApiClient.post(`/settlements/${settlementId}/payout`, {
        sourceRef: `payout_${settlementId}`,
      });
      showToast('Giải ngân thành công! Đã ghi nhận bút toán tất toán công nợ vào sổ cái.', 'success');
      await fetchFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Giải ngân thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleConfirmReturnReceived = async (returnRequestId: string) => {
    try {
      setActionId(returnRequestId);
      await ApiClient.post(`/supplier/disputes/${returnRequestId}/receive`, {
        sourceRef: `supp_recv_${returnRequestId}`,
      });
      showToast('Đã xác nhận hàng hoàn về kho! Hệ thống đã hoàn tiền cho khách & đảo bút toán đối soát.', 'success');
      await fetchFinanceData();
    } catch (err: any) {
      showToast(err.message || 'Xác nhận nhận hàng hoàn thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const renderSettlementBadge = (item: SupplierSettlementItem) => {
    if (item.status === 'HOLD' && item.hasOpenDispute) {
      return <Badge variant="destructive">Đóng băng (Đang có khiếu nại)</Badge>;
    }
    switch (item.status) {
      case 'HOLD':
        return <Badge variant="warning">Tạm giữ (7 ngày đổi trả)</Badge>;
      case 'ELIGIBLE':
      case 'CALCULATED':
        return <Badge variant="info">Đủ điều kiện chi trả</Badge>;
      case 'PAYOUT_PENDING':
        return <Badge variant="warning">Chờ ngân hàng xử lý</Badge>;
      case 'PAID':
        return <Badge variant="success">Đã giải ngân</Badge>;
      case 'REVERSED':
        return <Badge variant="destructive">Đã hoàn tiền / Đảo sổ cái</Badge>;
      default:
        return <Badge variant="secondary">{item.status}</Badge>;
    }
  };

  if (currentUser.role !== 'SUPPLIER' && currentUser.role !== 'ADMIN') {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto my-8 space-y-3 border border-line">
        <h2 className="text-lg font-bold text-ink">Khu vực dành cho Nhà cung cấp (Supplier)</h2>
        <p className="text-sm text-subtle">
          Vui lòng chuyển tài khoản sang <strong>Supplier</strong> để xem đối soát công nợ giá vốn và sổ cái tài chính.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle bg-surface border border-line px-2.5 py-1 rounded-full mb-2">
            Supplier Portal
          </span>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Tài Chính & Đối Soát Nhà Cung Cấp
          </h1>
          <p className="text-xs text-subtle mt-1">
            {data?.summary.legalName || currentUser.name} • Tài khoản nhận tiền:{' '}
            <span className="font-mono font-semibold text-ink">
              {data?.summary.payoutAccountRef || 'Đang tải...'}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchFinanceData}
          className="self-start sm:self-auto"
        >
          <Icon name="refresh" className="w-3.5 h-3.5 mr-1.5" />
          Làm mới số liệu
        </Button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border border-line bg-surface flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle shrink-0">
              <Icon name="clock" className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
                Tiền vốn đang tạm giữ (HOLD)
              </span>
              <div className="text-xl font-bold text-ink">
                <PriceDisplay amount={data.summary.holdingAmount} />
              </div>
              <p className="text-xs text-subtle">
                Giữ trong 7 ngày đổi trả sau khi giao
              </p>
            </div>
          </Card>

          <Card className="p-5 border border-line bg-surface flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle shrink-0">
              <Icon name="wallet" className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
                Đủ điều kiện giải ngân (ELIGIBLE)
              </span>
              <div className="text-xl font-bold text-ink">
                <PriceDisplay amount={data.summary.eligibleAmount} />
              </div>
              <p className="text-xs text-subtle">
                Đã hết hạn khiếu nại, sẵn sàng rút
              </p>
            </div>
          </Card>

          <Card className="p-5 border border-line bg-surface flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-line flex items-center justify-center text-subtle shrink-0">
              <Icon name="check" className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-subtle uppercase tracking-wider">
                Đã giải ngân thành công (PAID)
              </span>
              <div className="text-xl font-bold text-ink">
                <PriceDisplay amount={data.summary.paidAmount} />
              </div>
              <p className="text-xs text-subtle">
                Đã tất toán ({data.summary.reversedCount} đơn hoàn trả)
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Return Disputes Section for Warehouse Receipt */}
      {disputes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <Icon name="box" className="w-4 h-4 text-subtle" />
            <span>Yêu Cầu Trả Hàng Về Kho NCC</span>
            <Badge variant="warning">{disputes.length}</Badge>
          </h2>
          <div className="space-y-3">
            {disputes.map((d) => (
              <Card key={d.returnRequestId} className="p-5 border border-line bg-surface space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-ink">{d.fulfillmentNo}</span>
                      <span className="text-xs text-subtle">(Đơn tổng: {d.orderNo})</span>
                      <Badge variant={d.status === 'REFUNDED' ? 'destructive' : 'warning'}>
                        Trạng thái trả hàng: {d.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-ink mt-1">{d.productName}</p>
                    <p className="text-xs text-subtle">
                      Lý do: <strong>{d.reasonCode}</strong> — {d.description}
                    </p>
                    {d.returnTrackingNo && (
                      <p className="text-xs text-ink font-mono mt-1">
                        Mã vận đơn khách gửi trả: {d.returnTrackingNo}
                      </p>
                    )}
                  </div>

                  {(d.status === 'APPROVED' || d.status === 'RETURN_IN_TRANSIT') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConfirmReturnReceived(d.returnRequestId)}
                      disabled={actionId === d.returnRequestId}
                    >
                      <Icon name="check" className="w-3.5 h-3.5 mr-1.5" />
                      {actionId === d.returnRequestId
                        ? 'Đang xử lý...'
                        : 'Xác nhận kho đã nhận hàng hoàn & Hoàn tiền'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Settlements List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Danh Sách Khoản Đối Soát Theo Kiện Hàng</h2>
          <span className="text-xs text-subtle">Chỉ tính trên các kiện hàng đã DELIVERED</span>
        </div>

        {loading ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : !data || data.settlements.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="Chưa có khoản đối soát nào"
            description="Khi kiện hàng của bạn được giao thành công (DELIVERED), khoản đối soát giá vốn sẽ tự động xuất hiện tại đây."
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
                        {renderSettlementBadge(item)}
                      </div>
                      <p className="text-xs text-subtle">
                        Hạn mở khóa đối soát (7 ngày):{' '}
                        <span className="font-medium text-ink">
                          {item.eligibleAt
                            ? new Date(item.eligibleAt).toLocaleString('vi-VN')
                            : '—'}
                        </span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-subtle block">Tiền vốn gốc NCC nhận</span>
                      <span className="text-lg font-bold text-ink">
                        <PriceDisplay amount={item.supplierPayable} />
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-subtle font-mono">
                      Mã đối soát: {item.settlementId}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === 'HOLD' && !item.hasOpenDispute && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFastForwardEligible(item.settlementId)}
                          disabled={isBusy}
                        >
                          <Icon name="clock" className="w-3.5 h-3.5 mr-1.5" />
                          {isBusy ? 'Đang kiểm tra...' : 'Mô phỏng qua 7 ngày đổi trả'}
                        </Button>
                      )}

                      {item.status === 'HOLD' && item.hasOpenDispute && (
                        <span className="text-xs font-semibold text-danger">
                          Đang khóa giải ngân để chờ kết quả xử lý khiếu nại
                        </span>
                      )}

                      {(item.status === 'ELIGIBLE' ||
                        item.status === 'CALCULATED' ||
                        item.status === 'PAYOUT_PENDING') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleExecutePayout(item.settlementId)}
                          disabled={isBusy}
                        >
                          <Icon name="wallet" className="w-3.5 h-3.5 mr-1.5" />
                          {isBusy ? 'Đang giải ngân...' : 'Giải ngân về Ngân hàng (Mock Payout)'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Double-Entry Ledger Table */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">Sổ Cái Kế Toán Kép (Append-Only Financial Ledger)</h2>
          <p className="text-xs text-subtle">
            Mỗi nhóm nghiệp vụ (Transaction Group) luôn đảm bảo bất biến Tổng Nợ (DEBIT) = Tổng Có (CREDIT), không sửa xóa lịch sử.
          </p>
        </div>

        {!data || data.ledgerEntries.length === 0 ? (
          <Card className="p-6 text-center text-xs text-subtle border border-line">
            Chưa có phát sinh bút toán sổ cái nào.
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-subtle border-b border-line">
                <tr>
                  <th className="py-3 px-4 font-semibold">Thời gian</th>
                  <th className="py-3 px-4 font-semibold">Mã Group</th>
                  <th className="py-3 px-4 font-semibold">Tài khoản kế toán</th>
                  <th className="py-3 px-4 font-semibold">Vế (Nợ/Có)</th>
                  <th className="py-3 px-4 font-semibold text-right">Số tiền (VND)</th>
                  <th className="py-3 px-4 font-semibold">Diễn giải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.ledgerEntries.map((leg) => (
                  <tr key={leg.id} className="hover:bg-canvas/60">
                    <td className="py-3 px-4 whitespace-nowrap text-subtle">
                      {new Date(leg.postedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-ink">
                      {leg.transactionGroupRef}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-ink">
                      {leg.accountCode}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={leg.direction === 'CREDIT' ? 'success' : 'warning'}>
                        {leg.direction}
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
