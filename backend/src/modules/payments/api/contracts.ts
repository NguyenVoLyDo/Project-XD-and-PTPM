import { z } from "zod";

/**
 * 1. Phương thức thanh toán được hỗ trợ
 * - COD: Thanh toán tiền mặt khi nhận hàng
 * - ONLINE: Thanh toán qua cổng giả lập (VNPay/MoMo/Thẻ)
 */
export const paymentMethodSchema = z.enum(["COD", "ONLINE"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * 2. Trạng thái thanh toán của toàn bộ đơn tổng (Payment Status)
 */
export const paymentStatusSchema = z.enum([
  "PENDING",            // Đang chờ khách thanh toán online
  "PENDING_COD",        // Chờ thu tiền mặt khi giao hàng
  "PAID",               // Đã thanh toán online thành công
  "COLLECTED",          // Shipper đã thu tiền mặt COD thành công
  "PARTIALLY_REFUNDED", // Đã hoàn tiền 1 phần (khi 1 trong các đơn con bị hủy)
  "REFUNDED",           // Đã hoàn tiền toàn bộ
  "FAILED",             // Thanh toán thất bại hoặc quá hạn 15 phút
  "VOIDED",             // Hủy nghĩa vụ thu tiền COD (khi đơn hủy trước khi giao)
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * 3. Trạng thái tiền của từng đơn con nhà cung cấp (Allocation Status)
 */
export const allocationStatusSchema = z.enum([
  "PENDING",   // Chờ thanh toán
  "FUNDED",    // Tiền online đã về tài khoản sàn
  "COLLECTED", // Tiền mặt COD shipper đã thu
  "VOIDED",    // Đơn con bị từ chối trước khi ship -> hủy thu COD
  "REFUNDED",  // Đơn con online bị từ chối/trả hàng -> đã hoàn tiền cho khách
]);
export type AllocationStatus = z.infer<typeof allocationStatusSchema>;

/**
 * 4. DTO từng phần phân bổ cho đơn con (PaymentAllocation Draft)
 */
export const allocationDraftSchema = z.object({
  fulfillmentOrderId: z.string().min(1),
  merchandiseAmount: z.number().int().nonnegative(), // Tiền hàng (VND số nguyên)
  shippingAmount: z.number().int().nonnegative().default(0), // Tiền ship
  discountAmount: z.number().int().nonnegative().default(0), // Tiền giảm giá
  amountToCollect: z.number().int().nonnegative(), // = merchandise + shipping - discount
  currency: z.literal("VND").default("VND"),
});
export type AllocationDraft = z.infer<typeof allocationDraftSchema>;

/**
 * 5. Input khi module Orders gọi sang Payments để tạo nghĩa vụ thanh toán lúc Checkout
 */
export const createPaymentObligationSchema = z.object({
  orderId: z.string().min(1),
  method: paymentMethodSchema,
  allocations: z.array(allocationDraftSchema).min(1),
});
export type CreatePaymentObligationInput = z.infer<typeof createPaymentObligationSchema>;

/**
 * 6. Kết quả trả về sau khi tạo nghĩa vụ thanh toán
 */
export const checkoutObligationResponseSchema = z.object({
  paymentId: z.string(),
  paymentIntentId: z.string(),
  status: z.enum(["PENDING_COD", "PENDING"]),
  allocationIds: z.array(z.string()),
});
export type CheckoutObligationResponse = z.infer<typeof checkoutObligationResponseSchema>;

/**
 * 7. Webhook Payload từ Cổng thanh toán (Mock VNPay/MoMo)
 * Chứa chữ ký (signature) và ID sự kiện để chống gọi lặp (Idempotent)
 */
export const paymentWebhookPayloadSchema = z.object({
  provider: z.string().min(1),             // Ví dụ: "VNPAY", "MOMO"
  providerEventId: z.string().min(1),      // ID giao dịch duy nhất từ cổng thanh toán
  providerTransactionRef: z.string().min(1), // Mã tham chiếu giao dịch
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().int().positive(),     // Số tiền thực thu (VND)
  status: z.enum(["SUCCESS", "FAILED"]),   // Kết quả thanh toán từ cổng
  signature: z.string().min(1),            // Chữ ký bảo mật giả lập
  timestamp: z.string().datetime(),
});
export type PaymentWebhookPayload = z.infer<typeof paymentWebhookPayloadSchema>;

/**
 * 8. DTO xem chi tiết trạng thái thanh toán (cho Khách hàng và Admin)
 */
export const paymentDetailResponseSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  amount: z.number().int().nonnegative(),
  providerTransactionRef: z.string().nullable(),
  allocations: z.array(
    z.object({
      allocationId: z.string(),
      fulfillmentOrderId: z.string(),
      amountToCollect: z.number().int().nonnegative(),
      status: allocationStatusSchema,
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PaymentDetailResponse = z.infer<typeof paymentDetailResponseSchema>;
