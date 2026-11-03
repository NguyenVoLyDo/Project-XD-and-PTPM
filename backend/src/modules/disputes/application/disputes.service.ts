import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { StoreService } from '../../../common/database/store.service';
import { ReturnRequest } from '../../../common/database/types';
import { PaymentsService } from '../../payments/application/payments.service';
import { SettlementsService } from '../../settlements/application/settlements.service';
import {
  CreateDisputeInput,
  AdminDisputeDecisionInput,
} from '../api/contracts';

const RETURN_WINDOW_DAYS = 7;

export interface DisputeDecisionInput {
  decision: 'APPROVED' | 'REJECTED';
  reasonCode?: string;
  adminId: string;
}

export interface DisputeDecisionResult {
  returnRequestId: string;
  status: ReturnRequest['status'];
  decision: 'APPROVED' | 'REJECTED';
  reasonCode?: string;
  decidedAt: string;
  refundTriggered: boolean;
  refundId?: string;
}

@Injectable()
export class DisputesService {
  /**
   * Lưu vết các quyết định / hoàn tiền đã xử lý để đảm bảo Idempotency tuyệt đối
   */
  private readonly processedDecisionRefs = new Map<string, any>();

  /**
   * Lưu thông tin phạm vi khiếu nại (toàn bộ FulfillmentOrder hay riêng 1 OrderItem)
   * và mã vận đơn gửi trả hàng
   */
  private readonly disputeMeta = new Map<
    string,
    { isFullFulfillment: boolean; returnTrackingNo?: string; refundAmount: number }
  >();

  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
    @Optional()
    @Inject(PaymentsService)
    private readonly paymentsService?: PaymentsService,
    @Optional()
    @Inject(SettlementsService)
    private readonly settlementsService?: SettlementsService,
  ) {}

  /**
   * Tính số tiền cần hoàn cho 1 yêu cầu khiếu nại (chỉ tính trên đúng Allocation liên quan)
   */
  private computeRefundAmount(
    fulfillmentOrderId: string,
    specificOrderItemId?: string,
  ): { refundAmount: number; resolvedOrderItemId: string; isFullFulfillment: boolean } {
    const allocation = this.store.paymentAllocations.find(
      (pa) => pa.fulfillmentOrderId === fulfillmentOrderId,
    );
    const fItems = this.store.fulfillmentItems.filter(
      (fi) => fi.fulfillmentOrderId === fulfillmentOrderId,
    );

    if (fItems.length === 0) {
      throw new BadRequestException('Kiện hàng không có sản phẩm hợp lệ để khiếu nại');
    }

    if (specificOrderItemId) {
      const targetFi = fItems.find((fi) => fi.orderItemId === specificOrderItemId);
      if (!targetFi) {
        throw new BadRequestException(
          `Sản phẩm ${specificOrderItemId} không thuộc kiện hàng ${fulfillmentOrderId}`,
        );
      }
      const orderItem = this.store.orderItems.find((oi) => oi.id === specificOrderItemId);
      const itemAmount = orderItem
        ? orderItem.unitSalePriceSnapshot * targetFi.quantity
        : targetFi.itemGrossSnapshot;
      const maxCap = allocation ? allocation.amountToCollect : itemAmount;
      return {
        refundAmount: Math.min(itemAmount, maxCap),
        resolvedOrderItemId: specificOrderItemId,
        isFullFulfillment: fItems.length === 1,
      };
    }

    // Khiếu nại toàn bộ kiện hàng FulfillmentOrder
    const totalAmount = allocation
      ? allocation.amountToCollect
      : fItems.reduce((sum, fi) => sum + fi.itemGrossSnapshot, 0);

    return {
      refundAmount: totalAmount,
      resolvedOrderItemId: fItems[0].orderItemId,
      isFullFulfillment: true,
    };
  }

  /**
   * 1. KHÁCH HÀNG GỬI YÊU CẦU TRẢ HÀNG / KHIẾU NẠI (POST /api/v1/customer/disputes)
   * - Gắn chặt với 1 FulfillmentOrder (hoặc 1 OrderItem cụ thể trong đó)
   * - Kiểm tra ownership (chủ đơn CustomerOrder)
   * - Kiểm tra thời hạn 7 ngày từ khi DELIVERED (RETURN_WINDOW_EXPIRED)
   * - Chặn mở lại case CLOSED với cùng reasonCode
   * - Đóng băng khoản đối soát Settlement ở trạng thái HOLD
   */
  async createCustomerDispute(customerUserId: string, input: CreateDisputeInput) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === input.fulfillmentOrderId);
    if (!fo) {
      throw new NotFoundException(`Không tìm thấy kiện hàng: ${input.fulfillmentOrderId}`);
    }

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (!customerOrder || customerOrder.customerId !== customerUserId) {
      throw new ForbiddenException('Bạn không phải chủ sở hữu của đơn hàng này');
    }

    if (fo.status !== 'DELIVERED' && fo.status !== 'RETURN_REQUESTED') {
      throw new ConflictException({
        error: {
          code: 'FULFILLMENT_NOT_DELIVERED',
          message: 'Chỉ có thể gửi yêu cầu trả hàng / khiếu nại cho kiện hàng đã giao thành công (DELIVERED)',
          details: [],
        },
        message: 'Chỉ có thể gửi yêu cầu trả hàng / khiếu nại cho kiện hàng đã giao thành công (DELIVERED)',
      });
    }

    // Kiểm tra thời hạn đổi trả 7 ngày (returnWindowDays = 7)
    const deliveredAtMs = Date.parse(fo.updatedAt || fo.createdAt);
    const evaluationMs = input.now ? Date.parse(input.now) : Date.now();
    const expiryMs = deliveredAtMs + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    if (evaluationMs > expiryMs && !input.adminOverride) {
      throw new ConflictException({
        error: {
          code: 'RETURN_WINDOW_EXPIRED',
          message: 'Đã hết thời hạn yêu cầu trả hàng (quá 7 ngày kể từ khi giao hàng)',
          details: [],
        },
        message: 'Đã hết thời hạn yêu cầu trả hàng (quá 7 ngày kể từ khi giao hàng)',
      });
    }

    // Kiểm tra khiếu nại trùng hoặc mở lại case đã CLOSED với cùng reasonCode
    const existingCases = this.store.returnRequests.filter(
      (rr) =>
        rr.fulfillmentOrderId === fo.id &&
        (!input.orderItemId || rr.orderItemId === input.orderItemId),
    );

    const activeCase = existingCases.find(
      (rr) => rr.status !== 'CLOSED' && rr.status !== 'REJECTED' && rr.status !== 'REFUNDED',
    );
    if (activeCase) {
      throw new ConflictException({
        error: {
          code: 'DISPUTE_ALREADY_OPEN',
          message: 'Kiện hàng này đang có một yêu cầu khiếu nại chờ xử lý',
          details: [],
        },
        message: 'Kiện hàng này đang có một yêu cầu khiếu nại chờ xử lý',
      });
    }

    const closedSameReason = existingCases.find(
      (rr) =>
        (rr.status === 'CLOSED' || rr.status === 'REJECTED') &&
        rr.reasonCode === input.reasonCode,
    );
    if (closedSameReason) {
      throw new ConflictException({
        error: {
          code: 'CANNOT_REOPEN_CLOSED_CASE',
          message: `Không thể mở lại yêu cầu khiếu nại đã đóng với cùng lý do (${input.reasonCode})`,
          details: [],
        },
        message: `Không thể mở lại yêu cầu khiếu nại đã đóng với cùng lý do (${input.reasonCode})`,
      });
    }

    const { refundAmount, resolvedOrderItemId, isFullFulfillment } = this.computeRefundAmount(
      fo.id,
      input.orderItemId,
    );

    // Đảm bảo khoản đối soát tồn tại và khóa chặt ở trạng thái HOLD trong suốt thời gian khiếu nại
    if (fo.status === 'DELIVERED') {
      await this.settlementsService.ensureSettlementOnDelivered(fo.id).catch(() => {});
    }
    const settlement = this.store.settlements.find((s) => s.fulfillmentOrderId === fo.id);
    if (settlement && settlement.status === 'ELIGIBLE') {
      settlement.status = 'HOLD';
      settlement.updatedAt = new Date().toISOString();
    }

    const nowIso = new Date().toISOString();
    const returnRequestId = this.store.generateUuid();
    const newRequest: ReturnRequest = {
      id: returnRequestId,
      fulfillmentOrderId: fo.id,
      orderItemId: resolvedOrderItemId,
      customerId: customerUserId,
      reasonCode: input.reasonCode,
      reasonDescription: input.description,
      evidenceUrls: input.evidenceUrls || [],
      status: 'REQUESTED',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.store.returnRequests.unshift(newRequest);
    this.disputeMeta.set(returnRequestId, {
      isFullFulfillment,
      refundAmount,
    });

    this.store.logAudit(
      customerUserId,
      'RETURN_REQUESTED',
      'RETURN_REQUEST',
      returnRequestId,
      `Khách hàng gửi khiếu nại trả hàng cho kiện ${fo.fulfillmentNo} (${input.reasonCode}). Giữ HOLD đối soát.`,
    );

    return {
      returnRequestId,
      status: newRequest.status,
      fulfillmentOrderId: fo.id,
      orderItemId: resolvedOrderItemId,
      refundAmountEstimate: refundAmount,
      createdAt: nowIso,
    };
  }

  /**
   * Thực thi hoàn tiền & đảo bút toán đối soát (Nội bộ, Idempotent tuyệt đối)
   */
  private async executeDisputeRefund(rr: ReturnRequest, sourceRef: string, actorId: string) {
    const refundKey = `refund_exec:${rr.id}`;
    if (this.processedDecisionRefs.has(refundKey)) {
      return { ...this.processedDecisionRefs.get(refundKey), duplicate: true };
    }

    const allocation = this.store.paymentAllocations.find(
      (pa) => pa.fulfillmentOrderId === rr.fulfillmentOrderId,
    );
    if (!allocation) {
      throw new NotFoundException('Không tìm thấy phân bổ thanh toán của kiện hàng khiếu nại');
    }

    const meta = this.disputeMeta.get(rr.id);
    const refundAmount = meta ? meta.refundAmount : allocation.amountToCollect;
    const effectiveSourceRef = sourceRef || `DISPUTE_REFUND_${rr.id}`;

    // 1. Gọi Payments.refundAllocation (chỉ hoàn đúng trên allocation liên quan!)
    const paymentRefund = await this.paymentsService.refundAllocation(
      allocation.id,
      refundAmount,
      rr.reasonCode,
      effectiveSourceRef,
    );

    // 2. Gọi Settlements.recordAdjustment để đảo ngược bút toán kế toán kép & chuyển REVERSED
    const settlementAdj = await this.settlementsService.recordAdjustment(
      allocation.id,
      refundAmount,
      rr.reasonCode,
      effectiveSourceRef,
    );

    const nowIso = new Date().toISOString();
    rr.status = 'REFUNDED';
    rr.updatedAt = nowIso;

    const fo = this.store.fulfillmentOrders.find((f) => f.id === rr.fulfillmentOrderId);
    if (fo) {
      fo.status = 'REFUNDED';
      fo.updatedAt = nowIso;
    }

    this.store.logAudit(
      actorId,
      'DISPUTE_REFUND_COMPLETED',
      'RETURN_REQUEST',
      rr.id,
      `Hoàn tất hoàn tiền khiếu nại ${refundAmount}đ cho khách hàng và đảo ngược sổ cái đối soát.`,
    );

    const res = {
      returnRequestId: rr.id,
      status: rr.status,
      refundId: paymentRefund.refundId,
      refundedAmount: refundAmount,
      settlementStatus: settlementAdj.status || 'REVERSED',
      duplicate: false,
    };

    this.processedDecisionRefs.set(refundKey, res);
    return res;
  }

  /**
   * 2. ADMIN PHÊ DUYỆT HOẶC BÁC BỎ KHIẾU NẠI (POST /api/v1/admin/disputes/:id/decision)
   * - Idempotent: Gửi lặp quyết định không tạo Refund hoặc FinancialEntry thứ hai
   * - Bác bỏ (REJECTED): Đóng case (REJECTED -> CLOSED), không refund, giải phóng khóa HOLD cho Settlement
   * - Phê duyệt (APPROVED): Mở luồng trả hàng (hoặc hoàn tiền nhanh nếu bật instantRefundDemo)
   */
  async recordAdminDecision(
    adminUserId: string,
    returnRequestId: string,
    input: AdminDisputeDecisionInput,
  ) {
    const rr = this.store.returnRequests.find((r) => r.id === returnRequestId);
    if (!rr) {
      throw new NotFoundException(`Không tìm thấy yêu cầu khiếu nại: ${returnRequestId}`);
    }

    const dedupKey = input.sourceRef
      ? `decision_ref:${input.sourceRef}`
      : `decision:${rr.id}:${input.decision}`;

    if (this.processedDecisionRefs.has(dedupKey)) {
      return { ...this.processedDecisionRefs.get(dedupKey), duplicate: true };
    }

    if (rr.status === 'REFUNDED' || rr.status === 'CLOSED') {
      return {
        returnRequestId: rr.id,
        status: rr.status,
        adminDecision: rr.adminDecision,
        duplicate: true,
      };
    }

    const nowIso = new Date().toISOString();

    if (input.decision === 'REJECTED') {
      rr.status = 'CLOSED';
      rr.adminDecision = `REJECTED (${input.reasonCode})${input.note ? ': ' + input.note : ''}`;
      rr.updatedAt = nowIso;

      this.store.logAudit(
        adminUserId,
        'DISPUTE_DECISION_REJECTED',
        'RETURN_REQUEST',
        rr.id,
        `Admin bác bỏ khiếu nại (${input.reasonCode}). Đóng case, không hoàn tiền.`,
      );

      const rejectRes = {
        returnRequestId: rr.id,
        decision: 'REJECTED',
        status: rr.status,
        refundTriggered: false,
        duplicate: false,
      };
      this.processedDecisionRefs.set(dedupKey, rejectRes);
      return rejectRes;
    }

    // APPROVED
    rr.status = 'APPROVED';
    rr.adminDecision = `APPROVED (${input.reasonCode})${input.note ? ': ' + input.note : ''}`;
    rr.updatedAt = nowIso;

    this.store.logAudit(
      adminUserId,
      'DISPUTE_DECISION_APPROVED',
      'RETURN_REQUEST',
      rr.id,
      `Admin phê duyệt yêu cầu trả hàng (${input.reasonCode}). Chờ khách gửi hàng về kho.`,
    );

    if (input.instantRefundDemo) {
      const refundRes = await this.executeDisputeRefund(
        rr,
        input.sourceRef || `ADMIN_INSTANT_REFUND_${rr.id}`,
        adminUserId,
      );
      const combined = {
        ...refundRes,
        decision: 'APPROVED',
        refundTriggered: true,
      };
      this.processedDecisionRefs.set(dedupKey, combined);
      return combined;
    }

    const approveRes = {
      returnRequestId: rr.id,
      decision: 'APPROVED',
      status: rr.status,
      refundTriggered: false,
      duplicate: false,
    };
    this.processedDecisionRefs.set(dedupKey, approveRes);
    return approveRes;
  }

  /**
   * 3. KHÁCH HÀNG GỬI HÀNG TRẢ LẠI BƯU CỤC SAU KHI ĐƯỢC DUYỆT (APPROVED -> RETURN_IN_TRANSIT)
   */
  async shipReturnItem(
    customerUserId: string,
    returnRequestId: string,
    returnTrackingNo?: string,
  ) {
    const rr = this.store.returnRequests.find((r) => r.id === returnRequestId);
    if (!rr) {
      throw new NotFoundException(`Không tìm thấy yêu cầu trả hàng: ${returnRequestId}`);
    }

    if (rr.customerId !== customerUserId) {
      throw new ForbiddenException('Bạn không có quyền cập nhật yêu cầu trả hàng này');
    }

    if (rr.status === 'RETURN_IN_TRANSIT') {
      return { returnRequestId: rr.id, status: rr.status, duplicate: true };
    }

    if (rr.status !== 'APPROVED') {
      throw new ConflictException('Chỉ được gửi trả hàng sau khi yêu cầu khiếu nại đã được APPROVED');
    }

    const tracking = returnTrackingNo || `RET-${Date.now().toString().slice(-8)}`;
    rr.status = 'RETURN_IN_TRANSIT';
    rr.updatedAt = new Date().toISOString();

    const meta = this.disputeMeta.get(rr.id) || { isFullFulfillment: true, refundAmount: 0 };
    meta.returnTrackingNo = tracking;
    this.disputeMeta.set(rr.id, meta);

    this.store.logAudit(
      customerUserId,
      'RETURN_SHIPPED_BY_CUSTOMER',
      'RETURN_REQUEST',
      rr.id,
      `Khách hàng đã gửi kiện hàng hoàn trả. Mã vận đơn hoàn: ${tracking}`,
    );

    return {
      returnRequestId: rr.id,
      status: rr.status,
      returnTrackingNo: tracking,
    };
  }

  /**
   * 4. NHÀ CUNG CẤP (HOẶC ADMIN) XÁC NHẬN ĐÃ NHẬN HÀNG HOÀN VỀ KHO -> KÍCH HOẠT HOÀN TIỀN & ĐẢO SỔ CÁI
   * Transition: APPROVED / RETURN_IN_TRANSIT -> RECEIVED -> REFUNDED
   */
  async confirmReturnReceived(
    actorUserId: string,
    actorRole: string,
    supplierProfileId: string | undefined,
    returnRequestId: string,
    sourceRef?: string,
  ) {
    const rr = this.store.returnRequests.find((r) => r.id === returnRequestId);
    if (!rr) {
      throw new NotFoundException(`Không tìm thấy yêu cầu trả hàng: ${returnRequestId}`);
    }

    const fo = this.store.fulfillmentOrders.find((f) => f.id === rr.fulfillmentOrderId);
    if (!fo) {
      throw new NotFoundException('Không tìm thấy đơn vận chuyển gốc');
    }

    if (actorRole === 'SUPPLIER' && fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn chỉ được xác nhận hàng hoàn thuộc kho Nhà cung cấp của mình');
    }

    if (rr.status === 'REFUNDED' || rr.status === 'CLOSED') {
      return {
        returnRequestId: rr.id,
        status: rr.status,
        duplicate: true,
      };
    }

    if (rr.status !== 'APPROVED' && rr.status !== 'RETURN_IN_TRANSIT' && rr.status !== 'RECEIVED') {
      throw new ConflictException(
        `Không thể xác nhận nhận hàng hoàn khi khiếu nại đang ở trạng thái ${rr.status}`,
      );
    }

    rr.status = 'RECEIVED';
    rr.updatedAt = new Date().toISOString();

    return this.executeDisputeRefund(
      rr,
      sourceRef || `RETURN_RECEIVED_${rr.id}`,
      actorUserId,
    );
  }

  /**
   * Enrich dữ liệu hiển thị chi tiết 1 ReturnRequest
   */
  private enrichDispute(rr: ReturnRequest) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === rr.fulfillmentOrderId);
    const order = fo
      ? this.store.customerOrders.find((co) => co.id === fo.customerOrderId)
      : undefined;
    const orderItem = this.store.orderItems.find((oi) => oi.id === rr.orderItemId);
    const allocation = this.store.paymentAllocations.find(
      (pa) => pa.fulfillmentOrderId === rr.fulfillmentOrderId,
    );
    const supplier = fo
      ? this.store.supplierProfiles.find((s) => s.id === fo.supplierId)
      : undefined;
    const meta = this.disputeMeta.get(rr.id);

    return {
      returnRequestId: rr.id,
      fulfillmentOrderId: rr.fulfillmentOrderId,
      fulfillmentNo: fo?.fulfillmentNo || 'FO-UNKNOWN',
      orderId: order?.id || '',
      orderNo: order?.orderNo || 'DC-2026',
      orderItemId: rr.orderItemId,
      productName: orderItem?.productNameSnapshot || 'Sản phẩm trong kiện hàng',
      supplierName: supplier?.legalName || 'Nhà cung cấp',
      customerId: rr.customerId,
      reasonCode: rr.reasonCode,
      description: rr.reasonDescription,
      evidenceUrls: rr.evidenceUrls,
      status: rr.status,
      adminDecision: rr.adminDecision || null,
      returnTrackingNo: meta?.returnTrackingNo || null,
      refundAmount: meta?.refundAmount || allocation?.amountToCollect || 0,
      allocationStatus: allocation?.status || 'PENDING',
      createdAt: rr.createdAt,
      updatedAt: rr.updatedAt,
    };
  }

  /**
   * 5. LẤY CHI TIẾT 1 KHIẾU NẠI CỦA KHÁCH HÀNG (GET /api/v1/customer/disputes/:id)
   */
  async getCustomerDisputeById(customerUserId: string, returnRequestId: string) {
    const rr = this.store.returnRequests.find((r) => r.id === returnRequestId);
    if (!rr) {
      throw new NotFoundException(`Không tìm thấy khiếu nại: ${returnRequestId}`);
    }
    if (rr.customerId !== customerUserId) {
      throw new ForbiddenException('Bạn không có quyền xem khiếu nại của khách hàng khác');
    }
    return this.enrichDispute(rr);
  }

  /**
   * 6. LẤY DANH SÁCH KHIẾU NẠI + CÁC KIỆN HÀNG ĐÃ GIAO CÓ THỂ GỬI KHIẾU NẠI CỦA KHÁCH HÀNG
   */
  async getCustomerDisputesOverview(customerUserId: string) {
    const customerDisputes = this.store.returnRequests
      .filter((rr) => rr.customerId === customerUserId)
      .map((rr) => this.enrichDispute(rr));

    const customerOrders = this.store.customerOrders.filter(
      (co) => co.customerId === customerUserId,
    );
    const orderIdSet = new Set(customerOrders.map((co) => co.id));

    const eligibleFulfillments = this.store.fulfillmentOrders
      .filter((fo) => orderIdSet.has(fo.customerOrderId) && fo.status === 'DELIVERED')
      .map((fo) => {
        const order = customerOrders.find((co) => co.id === fo.customerOrderId)!;
        const supplier = this.store.supplierProfiles.find((s) => s.id === fo.supplierId);
        const fItems = this.store.fulfillmentItems.filter((fi) => fi.fulfillmentOrderId === fo.id);
        const items = fItems.map((fi) => {
          const oi = this.store.orderItems.find((item) => item.id === fi.orderItemId);
          return {
            orderItemId: fi.orderItemId,
            productName: oi?.productNameSnapshot || 'Sản phẩm',
            quantity: fi.quantity,
            unitSalePrice: oi?.unitSalePriceSnapshot || fi.itemGrossSnapshot,
          };
        });
        const hasActiveDispute = this.store.returnRequests.some(
          (rr) =>
            rr.fulfillmentOrderId === fo.id &&
            rr.status !== 'CLOSED' &&
            rr.status !== 'REJECTED',
        );
        return {
          fulfillmentOrderId: fo.id,
          fulfillmentNo: fo.fulfillmentNo,
          orderNo: order.orderNo,
          supplierName: supplier?.legalName || 'Nhà cung cấp',
          deliveredAt: fo.updatedAt || fo.createdAt,
          hasActiveDispute,
          items,
        };
      });

    return {
      disputes: customerDisputes,
      eligibleFulfillments,
    };
  }

  /**
   * 7. NHÀ CUNG CẤP XEM DANH SÁCH KHIẾU NẠI THUỘC KHO CỦA MÌNH
   */
  async getSupplierDisputes(supplierProfileId: string) {
    const supplierFoIds = new Set(
      this.store.fulfillmentOrders
        .filter((fo) => fo.supplierId === supplierProfileId)
        .map((fo) => fo.id),
    );

    return this.store.returnRequests
      .filter((rr) => supplierFoIds.has(rr.fulfillmentOrderId))
      .map((rr) => this.enrichDispute(rr));
  }

  /**
   * 8. ADMIN XEM TOÀN BỘ YÊU CẦU KHIẾU NẠI TRÊN HỆ THỐNG ĐỂ PHÊ DUYỆT
   */
  async getAdminDisputes() {
    return this.store.returnRequests.map((rr) => this.enrichDispute(rr));
  }
  /**
   * Compatibility methods for AdminController and Admin tests (docs/contracts/admin.md)
   */
  async listReturnRequests(status?: ReturnRequest['status']) {
    let list = this.store.returnRequests;
    if (status) {
      list = list.filter((r) => r.status === status);
    }
    return list.map((r) => this.enrichCompat(r));
  }

  async getReturnRequestById(id: string) {
    const rr = this.store.returnRequests.find((r) => r.id === id);
    if (!rr) throw new NotFoundException(`Không tìm thấy khiếu nại với ID: ${id}`);
    return this.enrichCompat(rr);
  }

  async decideDispute(returnRequestId: string, input: DisputeDecisionInput): Promise<DisputeDecisionResult> {
    const rr = this.store.returnRequests.find((r) => r.id === returnRequestId);
    if (!rr) {
      throw new NotFoundException(`Không tìm thấy khiếu nại với ID: ${returnRequestId}`);
    }

    const decidableStatuses: ReturnRequest['status'][] = ['REQUESTED', 'EVIDENCE_PENDING', 'UNDER_REVIEW'];
    if (!decidableStatuses.includes(rr.status)) {
      throw new BadRequestException(
        `Khiếu nại đang ở trạng thái "${rr.status}" — không thể ra quyết định. Chỉ có thể quyết định khi: ${decidableStatuses.join(', ')}`,
      );
    }

    const decidedAt = new Date().toISOString();
    let refundTriggered = false;
    let refundId: string | undefined;

    if (input.decision === 'APPROVED') {
      rr.status = 'APPROVED';
      rr.adminDecision = `APPROVED by ${input.adminId}${input.reasonCode ? ` [${input.reasonCode}]` : ''}`;
      rr.updatedAt = decidedAt;

      const fo = this.store.fulfillmentOrders.find((f) => f.id === rr.fulfillmentOrderId);
      if (fo) {
        const allocation = this.store.paymentAllocations.find(
          (a) => a.fulfillmentOrderId === fo.id && (a.status === 'FUNDED' || a.status === 'COLLECTED'),
        );

        if (allocation) {
          const orderItem = this.store.orderItems.find((oi) => oi.id === rr.orderItemId);
          const refundAmount = orderItem
            ? orderItem.unitSalePriceSnapshot * orderItem.quantity
            : allocation.amountToCollect;

          if (this.paymentsService) {
            try {
              const res = await this.paymentsService.refundAllocation(
                allocation.id,
                refundAmount,
                input.reasonCode || 'ADMIN_DISPUTE_APPROVED',
                `ADMIN_DECIDE_${returnRequestId}`,
              );
              refundId = res.refundId;
              refundTriggered = true;
            } catch {
              // fallback
            }
          }

          if (!refundTriggered) {
            const newRefund = {
              id: this.store.generateUuid(),
              paymentAllocationId: allocation.id,
              amount: refundAmount,
              status: 'PENDING' as const,
              reasonCode: input.reasonCode || 'ADMIN_DISPUTE_APPROVED',
              createdAt: decidedAt,
            };
            this.store.refunds.push(newRefund);
            refundTriggered = true;
            refundId = newRefund.id;
          }

          this.store.logAudit(
            input.adminId,
            'REFUND_INITIATED',
            'REFUND',
            refundId!,
            `Hoàn tiền ${refundAmount.toLocaleString('vi-VN')} VND cho khiếu nại ${returnRequestId}`,
            { returnRequestId, allocationId: allocation.id, amount: refundAmount },
          );
        }
      }

      this.store.sendNotification(
        rr.customerId,
        'Khiếu nại của bạn đã được chấp thuận',
        `Yêu cầu trả hàng của bạn (ID: ${returnRequestId}) đã được duyệt. ${refundTriggered ? 'Tiền hoàn sẽ được xử lý trong 3-5 ngày làm việc.' : 'Vui lòng liên hệ bộ phận hỗ trợ để được hướng dẫn.'}`,
        'SUCCESS',
      );
    } else {
      rr.status = 'REJECTED';
      rr.adminDecision = `REJECTED by ${input.adminId}${input.reasonCode ? ` [${input.reasonCode}]` : ''}`;
      rr.updatedAt = decidedAt;

      this.store.sendNotification(
        rr.customerId,
        'Khiếu nại của bạn bị từ chối',
        `Yêu cầu trả hàng (ID: ${returnRequestId}) không được chấp thuận${input.reasonCode ? ` (Lý do: ${input.reasonCode})` : ''}. Vui lòng liên hệ bộ phận hỗ trợ nếu bạn cần hỗ trợ thêm.`,
        'WARNING',
      );
    }

    this.store.logAudit(
      input.adminId,
      `DISPUTE_${input.decision}`,
      'RETURN_REQUEST',
      returnRequestId,
      input.reasonCode || `Admin decided ${input.decision}`,
      { decision: input.decision, refundTriggered, refundId },
    );

    return {
      returnRequestId,
      status: rr.status,
      decision: input.decision,
      reasonCode: input.reasonCode,
      decidedAt,
      refundTriggered,
      refundId,
    };
  }

  private enrichCompat(rr: ReturnRequest) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === rr.fulfillmentOrderId);
    const item = this.store.orderItems.find((oi) => oi.id === rr.orderItemId) as any;
    return {
      ...rr,
      fulfillmentOrderStatus: fo?.status,
      productName: item ? `${item.productNameSnapshot ?? item.productName ?? ''} (x${item.quantity})` : undefined,
      refundAmount: item
        ? (item.lineSaleTotal ?? item.unitSalePriceSnapshot * item.quantity)
        : undefined,
    };
  }
}
