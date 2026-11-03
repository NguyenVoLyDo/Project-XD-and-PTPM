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

interface EligibleFulfillmentItem {
  orderItemId: string;
  productName: string;
  quantity: number;
  unitSalePrice: number;
}

interface EligibleFulfillment {
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  orderNo: string;
  supplierName: string;
  deliveredAt: string;
  hasActiveDispute: boolean;
  items: EligibleFulfillmentItem[];
}

interface DisputeItem {
  returnRequestId: string;
  fulfillmentOrderId: string;
  fulfillmentNo: string;
  orderId: string;
  orderNo: string;
  orderItemId: string;
  productName: string;
  supplierName: string;
  customerId: string;
  reasonCode: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  adminDecision: string | null;
  returnTrackingNo: string | null;
  refundAmount: number;
  allocationStatus: string;
  createdAt: string;
  updatedAt: string;
}

const REASON_OPTIONS = [
  { code: 'DAMAGED_ITEM', label: 'Sản phẩm bị hư hỏng / trầy vỡ khi nhận' },
  { code: 'DEFECTIVE', label: 'Lỗi kỹ thuật không hoạt động đúng chức năng' },
  { code: 'WRONG_ITEM', label: 'Giao sai sản phẩm / sai mẫu mã' },
  { code: 'NOT_AS_DESCRIBED', label: 'Sản phẩm không giống mô tả gian hàng' },
];

export default function CustomerDisputesPage() {
  const { currentUser } = useAuth();
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [eligibleFulfillments, setEligibleFulfillments] = useState<EligibleFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [selectedFoId, setSelectedFoId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('DAMAGED_ITEM');
  const [description, setDescription] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchDisputesData = async () => {
    try {
      setLoading(true);
      if (currentUser.role === 'ADMIN') {
        const adminList = await ApiClient.get<DisputeItem[]>('/admin/disputes');
        setDisputes(Array.isArray(adminList) ? adminList : []);
        setEligibleFulfillments([]);
      } else if (currentUser.role === 'SUPPLIER') {
        const suppList = await ApiClient.get<DisputeItem[]>('/supplier/disputes');
        setDisputes(Array.isArray(suppList) ? suppList : []);
        setEligibleFulfillments([]);
      } else {
        const res = await ApiClient.get<{
          disputes: DisputeItem[];
          eligibleFulfillments: EligibleFulfillment[];
        }>('/customer/disputes');
        setDisputes(res?.disputes || []);
        const eligible = res?.eligibleFulfillments || [];
        setEligibleFulfillments(eligible);

        const firstAvailable = eligible.find((f) => !f.hasActiveDispute);
        if (firstAvailable && !selectedFoId) {
          setSelectedFoId(firstAvailable.fulfillmentOrderId);
          setSelectedItemId(firstAvailable.items[0]?.orderItemId || '');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Không thể tải danh sách khiếu nại', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputesData();
  }, [currentUser]);

  const handleFoChange = (foId: string) => {
    setSelectedFoId(foId);
    const match = eligibleFulfillments.find((f) => f.fulfillmentOrderId === foId);
    setSelectedItemId(match?.items[0]?.orderItemId || '');
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFoId) {
      showToast('Vui lòng chọn kiện hàng đã giao để gửi khiếu nại', 'error');
      return;
    }
    if (description.trim().length < 5) {
      showToast('Vui lòng nhập mô tả tình trạng lỗi ít nhất 5 ký tự', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await ApiClient.post('/customer/disputes', {
        fulfillmentOrderId: selectedFoId,
        orderItemId: selectedItemId || undefined,
        reasonCode,
        description: description.trim(),
        evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
      });
      showToast('Đã gửi yêu cầu khiếu nại. Tiền đối soát của đơn này đã được tạm khóa (HOLD).', 'success');
      setDescription('');
      setEvidenceUrl('');
      await fetchDisputesData();
    } catch (err: any) {
      showToast(err.message || 'Không thể gửi yêu cầu khiếu nại', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomerShipReturn = async (returnRequestId: string) => {
    try {
      setActionId(returnRequestId);
      const tracking = `RET-VNPOST-${Date.now().toString().slice(-6)}`;
      await ApiClient.post(`/customer/disputes/${returnRequestId}/ship-return`, {
        returnTrackingNo: tracking,
      });
      showToast(`Đã gửi kiện hàng hoàn trả về kho NCC. Mã vận đơn: ${tracking}`, 'success');
      await fetchDisputesData();
    } catch (err: any) {
      showToast(err.message || 'Gửi vận đơn trả hàng thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleAdminDecision = async (
    returnRequestId: string,
    decision: 'APPROVED' | 'REJECTED',
    instantRefundDemo: boolean = false,
  ) => {
    try {
      setActionId(returnRequestId);
      await ApiClient.post(`/admin/disputes/${returnRequestId}/decision`, {
        decision,
        reasonCode: decision === 'APPROVED' ? 'EVIDENCE_VERIFIED' : 'INSUFFICIENT_EVIDENCE',
        note:
          decision === 'APPROVED'
            ? 'Bằng chứng hợp lệ, chấp thuận đổi trả & hoàn tiền'
            : 'Không đủ cơ sở hoàn tiền, mở khóa đối soát cho NCC & Seller',
        instantRefundDemo,
        sourceRef: `admin_dec_${returnRequestId}_${decision}`,
      });
      if (decision === 'REJECTED') {
        showToast('Đã bác bỏ khiếu nại và đóng hồ sơ. Khoản đối soát đã được gỡ khóa.', 'success');
      } else if (instantRefundDemo) {
        showToast('Đã duyệt và hoàn tiền tức thì cho khách hàng kèm đảo bút toán sổ cái.', 'success');
      } else {
        showToast('Đã phê duyệt trả hàng. Chờ khách hàng gửi hàng hoàn về kho NCC.', 'success');
      }
      await fetchDisputesData();
    } catch (err: any) {
      showToast(err.message || 'Xử lý quyết định khiếu nại thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleConfirmReceived = async (returnRequestId: string) => {
    try {
      setActionId(returnRequestId);
      await ApiClient.post(`/supplier/disputes/${returnRequestId}/receive`, {
        sourceRef: `recv_${returnRequestId}`,
      });
      showToast('Đã xác nhận nhận hàng hoàn về kho. Hoàn tiền và đảo bút toán sổ cái hoàn tất.', 'success');
      await fetchDisputesData();
    } catch (err: any) {
      showToast(err.message || 'Xác nhận hàng hoàn thất bại', 'error');
    } finally {
      setActionId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
      case 'UNDER_REVIEW':
        return <Badge variant="warning">Chờ Admin xét duyệt</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Đã duyệt — Chờ khách gửi hàng trả</Badge>;
      case 'RETURN_IN_TRANSIT':
        return <Badge variant="warning">Hàng hoàn đang về kho NCC</Badge>;
      case 'RECEIVED':
        return <Badge variant="info">Kho đã nhận — Đang hoàn tiền</Badge>;
      case 'REFUNDED':
        return <Badge variant="success">Đã hoàn tiền cho khách</Badge>;
      case 'REJECTED':
      case 'CLOSED':
        return <Badge variant="secondary">Đã đóng hồ sơ</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedFo = eligibleFulfillments.find((f) => f.fulfillmentOrderId === selectedFoId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-white text-xs font-semibold ${
            toast.type === 'success' ? 'bg-ink' : 'bg-danger'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'check' : 'alert'} width={16} height={16} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Khiếu Nại, Đổi Trả & Hoàn Tiền
            </h1>
            <Badge variant="outline">
              {currentUser.role === 'ADMIN'
                ? 'Quản trị xét duyệt'
                : currentUser.role === 'SUPPLIER'
                  ? 'Kho Nhà cung cấp'
                  : 'Bảo vệ người mua 7 ngày'}
            </Badge>
          </div>
          <p className="text-xs text-subtle mt-1">
            Khiếu nại gắn trực tiếp với từng kiện hàng (FulfillmentOrder). Trong lúc khiếu nại mở, tiền đối soát được tạm giữ ở trạng thái HOLD.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchDisputesData}
          className="text-xs font-semibold self-start sm:self-auto"
        >
          <Icon name="refresh" width={14} height={14} />
          <span>Làm mới danh sách</span>
        </Button>
      </div>

      {/* Customer Dispute Creation Form */}
      {currentUser.role === 'CUSTOMER' && (
        <Card className="p-6 border border-line space-y-5">
          <div>
            <h2 className="text-base font-bold text-ink">Tạo yêu cầu trả hàng / hoàn tiền mới</h2>
            <p className="text-xs text-subtle mt-0.5">
              Áp dụng cho các kiện hàng đã giao thành công (DELIVERED) trong vòng 7 ngày gần nhất.
            </p>
          </div>

          {eligibleFulfillments.length === 0 ? (
            <div className="p-4 rounded-xl bg-canvas border border-line text-xs text-subtle">
              Bạn chưa có kiện hàng nào ở trạng thái <strong>Đã giao thành công (DELIVERED)</strong> để gửi khiếu nại.
            </div>
          ) : (
            <form onSubmit={handleCreateDispute} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">
                    1. Chọn kiện hàng đã nhận (Fulfillment Order)
                  </label>
                  <select
                    value={selectedFoId}
                    onChange={(e) => handleFoChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-canvas text-xs text-ink"
                  >
                    <option value="">-- Chọn kiện hàng --</option>
                    {eligibleFulfillments.map((fo) => (
                      <option
                        key={fo.fulfillmentOrderId}
                        value={fo.fulfillmentOrderId}
                        disabled={fo.hasActiveDispute}
                      >
                        {fo.fulfillmentNo} (Đơn {fo.orderNo} - {fo.supplierName})
                        {fo.hasActiveDispute ? ' [Đang có khiếu nại]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">
                    2. Sản phẩm cần khiếu nại trong kiện
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-canvas text-xs text-ink"
                  >
                    {selectedFo?.items.map((item) => (
                      <option key={item.orderItemId} value={item.orderItemId}>
                        {item.productName} (SL: {item.quantity} -{' '}
                        {item.unitSalePrice.toLocaleString('vi-VN')}đ)
                      </option>
                    )) || <option value="">-- Chọn kiện hàng trước --</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">
                    3. Lý do yêu cầu trả hàng / hoàn tiền
                  </label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-canvas text-xs text-ink"
                  >
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label} ({opt.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-ink">
                      4. Link ảnh / video bằng chứng (Tuỳ chọn)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEvidenceUrl('/images/charger.jpg')
                      }
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Điền ảnh mẫu
                    </button>
                  </div>
                  <input
                    type="text"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-xl border border-line bg-canvas text-xs text-ink"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-ink">
                    5. Mô tả chi tiết tình trạng sản phẩm
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDescription(
                        'Sản phẩm khi mở hộp bị nứt vỏ và cắm sạc không vào điện, đề nghị trả hàng hoàn tiền.',
                      )
                    }
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Điền nội dung mẫu
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả rõ lỗi sản phẩm bạn gặp phải để Admin và Nhà cung cấp đối chiếu..."
                  className="w-full p-3 rounded-xl border border-line bg-canvas text-xs text-ink"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !selectedFoId}
                  isLoading={submitting}
                >
                  <span>Gửi yêu cầu khiếu nại</span>
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Disputes List */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-ink">
          {currentUser.role === 'ADMIN'
            ? `Danh sách hồ sơ khiếu nại toàn sàn (${disputes.length})`
            : `Lịch sử yêu cầu khiếu nại & hoàn tiền (${disputes.length})`}
        </h2>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        ) : disputes.length === 0 ? (
          <EmptyState
            title="Chưa có hồ sơ khiếu nại nào"
            description="Các yêu cầu đổi trả hàng và hoàn tiền sẽ được hiển thị và theo dõi tiến trình tại đây."
          />
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => {
              const isBusy = actionId === d.returnRequestId;
              return (
                <Card key={d.returnRequestId} className="p-5 border border-line space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-ink">
                          {d.fulfillmentNo}
                        </span>
                        <span className="text-xs text-subtle">• Đơn gốc: {d.orderNo}</span>
                        <span className="text-xs text-subtle">• Kho: {d.supplierName}</span>
                        {renderStatusBadge(d.status)}
                      </div>
                      <p className="text-sm font-bold text-ink">{d.productName}</p>
                      <p className="text-xs text-subtle">
                        Mã lý do: <strong className="text-ink">{d.reasonCode}</strong> —{' '}
                        {d.description}
                      </p>
                      {d.evidenceUrls && d.evidenceUrls.length > 0 && (
                        <div className="pt-1">
                          <a
                            href={d.evidenceUrls[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <Icon name="externalLink" width={12} height={12} />
                            <span>Xem bằng chứng đính kèm</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-xs text-subtle block">Giá trị hoàn tiền</span>
                      <span className="text-lg font-bold text-ink">
                        <PriceDisplay amount={d.refundAmount} />
                      </span>
                      <span className="block text-[11px] text-subtle mt-0.5">
                        Trạng thái tiền: <strong>{d.allocationStatus}</strong>
                      </span>
                    </div>
                  </div>

                  {(d.adminDecision || d.returnTrackingNo) && (
                    <div className="p-3 rounded-xl bg-canvas border border-line text-xs space-y-1">
                      {d.adminDecision && (
                        <p>
                          <strong>Quyết định của Admin:</strong> {d.adminDecision}
                        </p>
                      )}
                      {d.returnTrackingNo && (
                        <p>
                          <strong>Mã vận đơn gửi trả hàng:</strong>{' '}
                          <span className="font-mono text-ink font-semibold">
                            {d.returnTrackingNo}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-subtle font-mono">
                      Mã hồ sơ: {d.returnRequestId} • Tạo lúc:{' '}
                      {new Date(d.createdAt).toLocaleString('vi-VN')}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentUser.role === 'CUSTOMER' && d.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          onClick={() => handleCustomerShipReturn(d.returnRequestId)}
                          disabled={isBusy}
                          isLoading={isBusy}
                        >
                          <Icon name="truck" width={14} height={14} />
                          <span>Xác nhận đã gửi hàng trả</span>
                        </Button>
                      )}

                      {currentUser.role === 'ADMIN' &&
                        (d.status === 'REQUESTED' ||
                          d.status === 'EVIDENCE_PENDING' ||
                          d.status === 'UNDER_REVIEW') && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAdminDecision(d.returnRequestId, 'APPROVED', false)}
                              disabled={isBusy}
                            >
                              <Icon name="check" width={14} height={14} />
                              <span>Duyệt cho trả hàng</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdminDecision(d.returnRequestId, 'APPROVED', true)}
                              disabled={isBusy}
                            >
                              <span>Duyệt & Hoàn tiền ngay</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAdminDecision(d.returnRequestId, 'REJECTED', false)}
                              disabled={isBusy}
                            >
                              <Icon name="close" width={14} height={14} />
                              <span>Bác bỏ khiếu nại</span>
                            </Button>
                          </>
                        )}

                      {(currentUser.role === 'SUPPLIER' || currentUser.role === 'ADMIN') &&
                        (d.status === 'APPROVED' || d.status === 'RETURN_IN_TRANSIT') && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmReceived(d.returnRequestId)}
                            disabled={isBusy}
                            isLoading={isBusy}
                          >
                            <Icon name="box" width={14} height={14} />
                            <span>Xác nhận kho đã nhận hàng & Hoàn tiền</span>
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
    </div>
  );
}
