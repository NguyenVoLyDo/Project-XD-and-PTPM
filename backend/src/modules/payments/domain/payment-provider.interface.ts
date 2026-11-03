/**
 * Payment Provider Interface — Kiến trúc Provider độc lập
 *
 * Mục tiêu: Tách biệt hoàn toàn logic nghiệp vụ thanh toán khỏi từng nhà cung cấp cụ thể
 * (VNPay, MoMo, PayOS, v.v.). Mỗi nhà cung cấp chỉ cần implement interface này.
 *
 * QUAN TRỌNG:
 * - Không hardcode secret hoặc API key trong code.
 * - Không implement thuật toán chữ ký khi chưa có tài liệu chính thức từ nhà cung cấp.
 * - Chữ ký phải được verify bằng HMAC-SHA256/SHA512 theo tài liệu của từng provider.
 * - Đây là kiến trúc và adapter phục vụ kiểm thử — chưa tích hợp cổng thanh toán thật.
 */

export type PaymentProviderCode = 'VNPAY' | 'MOMO' | 'PAYOS' | 'MOCK';

export type ProviderPaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED' | 'REFUNDED';

/**
 * Dữ liệu đầu vào để tạo Payment Intent (yêu cầu thanh toán) với provider.
 */
export interface CreatePaymentIntentInput {
  /** Mã đơn hàng nội bộ DropConnect */
  orderId: string;
  /** Tổng số tiền (đơn vị: đồng VND) */
  amount: number;
  currency: 'VND';
  /** Mã Idempotency để tránh tạo trùng payment intent */
  idempotencyKey: string;
  /** URL cổng provider redirect về sau khi thanh toán */
  returnUrl: string;
  /** URL cổng provider gọi về (webhook/callback) */
  notifyUrl: string;
  /** Mô tả đơn hàng */
  description?: string;
  /** Metadata tùy chỉnh */
  metadata?: Record<string, string>;
}

/**
 * Kết quả tạo Payment Intent.
 */
export interface CreatePaymentIntentResult {
  /** ID duy nhất của payment intent phía provider */
  providerPaymentId: string;
  /** URL chuyển hướng khách hàng để thanh toán */
  checkoutUrl: string;
  /** QR code data (nếu provider hỗ trợ) */
  qrCodeData?: string;
  /** Thời hạn thanh toán (ISO 8601) */
  expiresAt?: string;
  /** Raw response từ provider để lưu log */
  rawProviderResponse: Record<string, unknown>;
}

/**
 * Raw payload webhook/callback từ provider (chưa verify).
 */
export interface RawWebhookPayload {
  /** Headers từ HTTP request */
  headers: Record<string, string | string[] | undefined>;
  /** Body của webhook */
  body: Record<string, unknown>;
  /** Query params (một số provider như VNPay dùng query params) */
  query?: Record<string, string | undefined>;
}

/**
 * Kết quả sau khi verify và parse webhook.
 */
export interface VerifiedWebhookEvent {
  /** ID của payment phía provider */
  providerPaymentId: string;
  /** ID đơn hàng nội bộ DropConnect */
  orderId: string;
  /** Số tiền provider báo về */
  amount: number;
  currency: 'VND';
  /** Trạng thái thanh toán theo provider */
  status: ProviderPaymentStatus;
  /** Mã giao dịch provider (dùng để đối soát) */
  providerTransactionRef: string;
  /** Thời điểm provider xử lý giao dịch */
  processedAt: string;
  /** ID event duy nhất (dùng cho idempotency) */
  eventId: string;
  /** Raw payload đã verify (lưu lịch sử) */
  rawPayload: Record<string, unknown>;
}

/**
 * Input để tạo Refund với provider.
 */
export interface CreateRefundInput {
  /** ID giao dịch gốc cần hoàn */
  providerTransactionRef: string;
  /** Số tiền hoàn (VND) */
  amount: number;
  /** Lý do hoàn tiền */
  reasonCode: string;
  /** Mã Idempotency để tránh hoàn trùng */
  idempotencyKey: string;
}

/**
 * Kết quả tạo Refund.
 */
export interface CreateRefundResult {
  providerRefundId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  rawProviderResponse: Record<string, unknown>;
}

/**
 * Interface chính mà mọi Payment Provider Adapter phải implement.
 *
 * Quy tắc:
 * 1. Mọi method phải throw `PaymentProviderError` khi có lỗi từ provider.
 * 2. `verifyWebhookSignature` PHẢI implement thuật toán chữ ký chính thức của provider.
 * 3. Không log secret/credentials.
 * 4. Tất cả raw response từ provider phải được lưu lại để audit.
 */
export interface IPaymentProvider {
  /** Mã định danh provider */
  readonly code: PaymentProviderCode;

  /**
   * Tạo yêu cầu thanh toán (Payment Intent) với provider.
   * @throws PaymentProviderError khi provider trả về lỗi hoặc không thể kết nối.
   */
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;

  /**
   * Xác minh chữ ký webhook từ provider.
   *
   * QUAN TRỌNG: Implementation phải sử dụng thuật toán crypto cụ thể của provider.
   * Không được return true mà không verify thực sự.
   * Sử dụng timing-safe comparison (crypto.timingSafeEqual) để chống timing attack.
   *
   * @returns true nếu chữ ký hợp lệ
   * @throws PaymentProviderError nếu thiếu thông tin verify
   */
  verifyWebhookSignature(raw: RawWebhookPayload): boolean;

  /**
   * Parse và normalize webhook payload đã được verify thành VerifiedWebhookEvent.
   * Chỉ được gọi SAU KHI verifyWebhookSignature trả về true.
   *
   * Validation bắt buộc:
   * - Kiểm tra orderId, amount, currency khớp với dữ liệu trong hệ thống.
   * - Kiểm tra eventId chưa được xử lý (idempotency).
   */
  parseWebhookPayload(raw: RawWebhookPayload): VerifiedWebhookEvent;

  /**
   * Tạo yêu cầu hoàn tiền với provider.
   * @throws PaymentProviderError nếu provider từ chối hoặc giao dịch không hoàn được.
   */
  createRefund?(input: CreateRefundInput): Promise<CreateRefundResult>;

  /**
   * Kiểm tra trạng thái thanh toán trực tiếp từ provider (polling fallback).
   * Dùng khi webhook không nhận được.
   */
  getPaymentStatus?(providerPaymentId: string): Promise<ProviderPaymentStatus>;
}

/**
 * Custom error class cho Payment Provider.
 */
export class PaymentProviderError extends Error {
  constructor(
    public readonly providerCode: PaymentProviderCode,
    public readonly errorCode: string,
    message: string,
    public readonly httpStatus?: number,
    public readonly rawResponse?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

