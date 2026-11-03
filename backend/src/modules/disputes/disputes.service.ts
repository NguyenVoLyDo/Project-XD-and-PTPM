/**
 * DisputesService — Xử lý khiếu nại và yêu cầu trả hàng.
 *
 * Nghiệp vụ hiện tại:
 * - Admin có quyền duyệt (APPROVED) hoặc từ chối (REJECTED) ReturnRequest.
 * - Khi APPROVED: trạng thái ReturnRequest → APPROVED, kích hoạt hoàn tiền (nếu đã thanh toán).
 * - Khi REJECTED: trạng thái ReturnRequest → REJECTED, ghi nhật ký và thông báo.
 * - Mọi quyết định đều ghi AuditLog với actorId, reasonCode và kết quả.
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { StoreService } from '../../common/database/store.service';
import { ReturnRequest } from '../../common/database/types';

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
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  /**
   * Lấy danh sách tất cả ReturnRequest, lọc theo status nếu có.
   */
  async listReturnRequests(status?: ReturnRequest['status']) {
    let list = this.store.returnRequests;
    if (status) {
      list = list.filter((r) => r.status === status);
    }
    return list.map((r) => this.enrich(r));
  }

  /**
   * Lấy chi tiết một ReturnRequest theo ID.
   */
  async getReturnRequestById(id: string) {
    const rr = this.store.returnRequests.find((r) => r.id === id);
    if (!rr) throw new NotFoundException(`Không tìm thấy khiếu nại với ID: ${id}`);
    return this.enrich(rr);
  }

  /**
   * Admin ra quyết định xử lý khiếu nại.
   */
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

      // Tìm PaymentAllocation tương ứng với FulfillmentOrder để hoàn tiền
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

          this.store.logAudit(
            input.adminId,
            'REFUND_INITIATED',
            'REFUND',
            newRefund.id,
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

  private enrich(rr: ReturnRequest) {
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
