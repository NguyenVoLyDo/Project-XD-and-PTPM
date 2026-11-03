import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Optional,
} from '@nestjs/common';
import { StoreService } from '../../../common/database/store.service';
import {
  Payment,
  PaymentAllocation,
  PaymentStatus,
  AllocationStatus,
  Refund,
} from '../../../common/database/types';
import {
  CreatePaymentObligationInput,
  CheckoutObligationResponse,
  PaymentWebhookPayload,
  PaymentDetailResponse,
} from '../api/contracts';
import { DemoCheckoutState } from '../../../integration/store-adapters.service';

@Injectable()
export class PaymentsService {
  /**
   * Bộ nhớ lưu các event webhook đã xử lý để đảm bảo tính Idempotency (chống trùng lặp).
   * Key dạng: `${provider}:${providerEventId}`
   */
  private readonly processedWebhookEvents = new Set<string>();
  private readonly processedRefundRefs = new Map<
    string,
    { refundId: string; allocationId: string; refundedAmount: number; paymentStatus: PaymentStatus; duplicate?: boolean }
  >();

  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
    @Optional()
    @Inject(DemoCheckoutState)
    private readonly demoState?: DemoCheckoutState,
  ) {}

  /**
   * 1. TẠO NGHĨA VỤ THANH TOÁN KHI CHECKOUT (createCheckoutObligation)
   * 
   * Được gọi từ quy trình Checkout của module Orders.
   * - Tạo 1 bản ghi Payment (đại diện cho cả đơn tổng)
   * - Tạo N bản ghi PaymentAllocation (chia nhỏ số tiền cho từng nhà cung cấp / Supplier)
   */
  async createCheckoutObligation(
    input: CreatePaymentObligationInput,
  ): Promise<CheckoutObligationResponse> {
    const { orderId, method, allocations } = input;

    if (!allocations || allocations.length === 0) {
      throw new BadRequestException('Danh sách phân bổ thanh toán không được để trống');
    }

    // 1. Kiểm tra tính toàn vẹn (Invariant) của từng đơn con:
    // Số tiền cần thu (amountToCollect) = Tiền hàng + Tiền ship - Tiền giảm giá
    for (const alloc of allocations) {
      const calculatedAmount =
        alloc.merchandiseAmount + alloc.shippingAmount - alloc.discountAmount;
      if (alloc.amountToCollect !== calculatedAmount) {
        throw new BadRequestException(
          `Số tiền phân bổ không khớp cho đơn con ${alloc.fulfillmentOrderId}. Tính toán: ${calculatedAmount}, khai báo: ${alloc.amountToCollect}`,
        );
      }
    }

    // 2. Tính tổng tiền của đơn hàng
    const totalAmount = allocations.reduce((sum, a) => sum + a.amountToCollect, 0);

    const paymentId = this.store.generateUuid();
    const paymentIntentId = `pi_${this.store.generateUuid().slice(0, 12)}`;

    // 3. Phân nhánh trạng thái theo phương thức thanh toán
    const isCod = method === 'COD';
    const initialPaymentStatus: PaymentStatus = isCod ? 'PENDING_COD' : 'PENDING';
    const initialAllocationStatus: AllocationStatus = 'PENDING';

    // 4. Lưu từng phần phân bổ (PaymentAllocation) tương ứng với từng FulfillmentOrder
    const createdAllocationIds: string[] = [];
    for (const alloc of allocations) {
      const allocationId = alloc.fulfillmentOrderId; // Dùng chung ID hoặc sinh mới
      const newAllocation: PaymentAllocation = {
        id: allocationId,
        paymentId,
        fulfillmentOrderId: alloc.fulfillmentOrderId,
        merchandiseAmount: alloc.merchandiseAmount,
        shippingAmount: alloc.shippingAmount,
        discountAmount: alloc.discountAmount,
        amountToCollect: alloc.amountToCollect,
        currency: 'VND',
        status: initialAllocationStatus,
        createdAt: new Date().toISOString(),
      };
      this.store.paymentAllocations.push(newAllocation);
      createdAllocationIds.push(allocationId);
    }

    // 5. Lưu bản ghi Payment tổng
    const newPayment: Payment = {
      id: paymentId,
      customerOrderId: orderId,
      paymentIntentId,
      method: isCod ? 'COD' : 'ONLINE_MOCK',
      status: initialPaymentStatus,
      amount: totalAmount,
      providerTransactionRef: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.payments.push(newPayment);

    // 6. Ghi log kiểm toán (Audit Log)
    this.store.logAudit(
      null,
      'CREATE_PAYMENT_OBLIGATION',
      'PAYMENT',
      paymentId,
      `Tạo nghĩa vụ thanh toán ${method} cho đơn hàng ${orderId} tổng tiền ${totalAmount} VND`,
    );

    return {
      paymentId,
      paymentIntentId,
      status: isCod ? 'PENDING_COD' : 'PENDING',
      allocationIds: createdAllocationIds,
    };
  }

  /**
   * 2. XỬ LÝ WEBHOOK TỪ CỔNG THANH TOÁN (Mô phỏng VNPay / MoMo / VietQR)
   * 
   * Tính năng cốt lõi:
   * - Xác thực chữ ký
   * - Chống trùng lặp (Idempotent): nếu cổng thanh toán bắn lại cùng eventId, trả về 200 mà không cộng tiền lần 2
   * - Cập nhật trạng thái Payment sang PAID và đơn hàng sang CONFIRMED
   */
  async handleWebhook(payload: PaymentWebhookPayload) {
    // 1. Kiểm tra chữ ký bảo mật (Mock signature check)
    if (payload.signature === 'INVALID_SIGNATURE') {
      throw new BadRequestException('Chữ ký Webhook không hợp lệ');
    }

    // 2. Chống gọi lặp (Idempotency) bằng cặp (provider, providerEventId)
    const idempotencyKey = `${payload.provider}:${payload.providerEventId}`;
    if (this.processedWebhookEvents.has(idempotencyKey)) {
      return {
        success: true,
        message: 'Event Webhook đã được ghi nhận trước đó (Idempotent - Bỏ qua xử lý lặp)',
        duplicate: true,
      };
    }

    // 3. Tìm bản ghi Payment tương ứng
    const payment = this.store.payments.find(
      (p) => p.id === payload.paymentId || p.customerOrderId === payload.orderId,
    );
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy giao dịch thanh toán cho mã ${payload.paymentId}`);
    }

    const now = new Date().toISOString();

    // 4. Xử lý theo kết quả thanh toán từ cổng:
    if (payload.status === 'SUCCESS') {
      // a. Cập nhật Payment
      payment.status = 'PAID';
      payment.providerTransactionRef = payload.providerTransactionRef;
      payment.updatedAt = now;

      // b. Cập nhật toàn bộ các Allocation sang FUNDED (tiền đã về tài khoản sàn)
      const allocations = this.store.paymentAllocations.filter((a) => a.paymentId === payment.id);
      for (const alloc of allocations) {
        alloc.status = 'FUNDED';
      }

      // c. Cập nhật CustomerOrder trong storeService từ PENDING_PAYMENT sang CONFIRMED
      const order = this.store.customerOrders.find((o) => o.id === payment.customerOrderId);
      if (order && order.status === 'PENDING_PAYMENT') {
        order.status = 'CONFIRMED';
        order.updatedAt = now;
      }

      // d. Đồng bộ sang DemoCheckoutState (nơi OrdersRepositoryAdapter đọc cho API /orders/:id)
      if (this.demoState) {
        const agg = this.demoState.orders.get(payment.customerOrderId);
        if (agg) {
          (agg.order as any).status = 'CONFIRMED';
          (agg.order as any).paymentStatus = 'PAID';
          (agg.order as any).updatedAt = now;
        }
      }

      this.store.logAudit(
        null,
        'PAYMENT_SUCCEEDED',
        'PAYMENT',
        payment.id,
        `Thanh toán Online thành công qua ${payload.provider}. Mã GD: ${payload.providerTransactionRef}`,
      );
    } else {
      // Thanh toán thất bại (FAILED)
      payment.status = 'FAILED';
      payment.updatedAt = now;

      // Hủy phân bổ tiền
      const allocations = this.store.paymentAllocations.filter((a) => a.paymentId === payment.id);
      for (const alloc of allocations) {
        alloc.status = 'VOIDED';
      }

      // Cập nhật đơn hàng thành PAYMENT_FAILED
      const order = this.store.customerOrders.find((o) => o.id === payment.customerOrderId);
      if (order && order.status === 'PENDING_PAYMENT') {
        order.status = 'PAYMENT_FAILED';
        order.updatedAt = now;
      }

      if (this.demoState) {
        const agg = this.demoState.orders.get(payment.customerOrderId);
        if (agg) {
          (agg.order as any).status = 'PAYMENT_FAILED';
          (agg.order as any).paymentStatus = 'FAILED';
          (agg.order as any).updatedAt = now;
        }
      }

      // Nhả lượng tồn kho đã giữ (Stock Reservation -> RELEASED)
      const orderItems = this.store.orderItems.filter((oi) => oi.customerOrderId === payment.customerOrderId);
      const itemIds = orderItems.map((oi) => oi.id);
      const reservations = this.store.stockReservations.filter(
        (r) => itemIds.includes(r.orderItemId) && r.status === 'HELD',
      );
      for (const res of reservations) {
        res.status = 'RELEASED';
      }

      this.store.logAudit(
        null,
        'PAYMENT_FAILED',
        'PAYMENT',
        payment.id,
        `Thanh toán Online thất bại qua ${payload.provider}`,
      );
    }

    // 5. Đánh dấu event đã xử lý xong để chặn các lần gọi lặp sau này
    this.processedWebhookEvents.add(idempotencyKey);

    return {
      success: true,
      paymentId: payment.id,
      status: payment.status,
      duplicate: false,
    };
  }

  /**
   * 3. LẤY CHI TIẾT THANH TOÁN KÈM THEO CÁC PHÂN BỔ ĐƠN CON
   */
  async getPaymentById(paymentId: string): Promise<PaymentDetailResponse> {
    const payment = this.store.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy thanh toán với ID: ${paymentId}`);
    }

    const allocations = this.store.paymentAllocations.filter((a) => a.paymentId === payment.id);

    return {
      paymentId: payment.id,
      orderId: payment.customerOrderId,
      method: payment.method === 'COD' ? 'COD' : 'ONLINE',
      status: payment.status,
      amount: payment.amount,
      providerTransactionRef: payment.providerTransactionRef || null,
      allocations: allocations.map((a) => ({
        allocationId: a.id,
        fulfillmentOrderId: a.fulfillmentOrderId,
        amountToCollect: a.amountToCollect,
        status: a.status,
      })),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * 4. HOÀN TIỀN CHO MỘT ĐƠN CON (refundAllocation)
   * 
   * Khi 1 nhà cung cấp từ chối (reject) đơn con hoặc khách trả hàng thành công:
   * Chỉ hoàn đúng số tiền của đơn con đó, không làm ảnh hưởng các đơn con khác.
   */
  async refundAllocation(
    allocationId: string,
    amount: number,
    reasonCode: string,
    sourceRef: string,
  ) {
    if (sourceRef && this.processedRefundRefs.has(sourceRef)) {
      const existing = this.processedRefundRefs.get(sourceRef)!;
      return { ...existing, duplicate: true };
    }

    const allocation = this.store.paymentAllocations.find(
      (a) => a.id === allocationId || a.fulfillmentOrderId === allocationId,
    );
    if (!allocation) {
      throw new NotFoundException(`Không tìm thấy phân bổ thanh toán: ${allocationId}`);
    }

    const existingRefundTotal = this.store.refunds
      .filter((r) => r.paymentAllocationId === allocation.id && r.status === 'REFUNDED')
      .reduce((sum, r) => sum + r.amount, 0);

    if (amount <= 0 || existingRefundTotal + amount > allocation.amountToCollect) {
      throw new BadRequestException('Số tiền hoàn không hợp lệ hoặc vượt quá số tiền đã thu');
    }

    const payment = this.store.payments.find((p) => p.id === allocation.paymentId);
    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán gốc');
    }

    // Tạo bản ghi hoàn tiền (Refund)
    const refundId = this.store.generateUuid();
    const newRefund: Refund = {
      id: refundId,
      paymentAllocationId: allocation.id,
      amount,
      status: 'REFUNDED',
      reasonCode,
      createdAt: new Date().toISOString(),
    };
    this.store.refunds.push(newRefund);

    // Cập nhật trạng thái allocation sang REFUNDED
    allocation.status = 'REFUNDED';

    // Cập nhật trạng thái Payment tổng (REFUNDED nếu hoàn tất cả, PARTIALLY_REFUNDED nếu hoàn 1 phần)
    const allAllocations = this.store.paymentAllocations.filter((a) => a.paymentId === payment.id);
    const allRefunded =
      allAllocations.every((a) => a.status === 'REFUNDED') &&
      existingRefundTotal + amount >= allocation.amountToCollect;
    payment.status = allRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    payment.updatedAt = new Date().toISOString();

    this.store.logAudit(
      null,
      'REFUND_ALLOCATION',
      'PAYMENT_ALLOCATION',
      allocation.id,
      `Hoàn tiền ${amount} VND cho đơn con ${allocation.fulfillmentOrderId}. Lý do: ${reasonCode}. Ref: ${sourceRef}`,
    );

    const response = {
      refundId,
      allocationId: allocation.id,
      refundedAmount: amount,
      paymentStatus: payment.status,
      duplicate: false,
    };

    if (sourceRef) {
      this.processedRefundRefs.set(sourceRef, response);
    }

    return response;
  }

  /**
   * 5. HỦY THU TIỀN COD CHO ĐƠN CON BỊ HỦY TRƯỚC GIAO (voidAllocation)
   */
  async voidAllocation(allocationId: string, reasonCode: string, sourceRef: string) {
    const allocation = this.store.paymentAllocations.find((a) => a.id === allocationId);
    if (!allocation) {
      throw new NotFoundException(`Không tìm thấy phân bổ thanh toán: ${allocationId}`);
    }

    allocation.status = 'VOIDED';

    this.store.logAudit(
      null,
      'VOID_ALLOCATION',
      'PAYMENT_ALLOCATION',
      allocation.id,
      `Hủy thu tiền COD cho đơn con ${allocation.fulfillmentOrderId}. Lý do: ${reasonCode}. Ref: ${sourceRef}`,
    );

    return {
      allocationId: allocation.id,
      status: 'VOIDED',
    };
  }
}
