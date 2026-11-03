import { z } from 'zod';

/**
 * 1. Trạng thái vòng đời Khiếu nại / Trả hàng (ReturnRequest Status)
 * Theo docs/contracts/disputes.md
 */
export const returnRequestStatusSchema = z.enum([
  'REQUESTED',
  'EVIDENCE_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURN_IN_TRANSIT',
  'RECEIVED',
  'REFUNDED',
  'CLOSED',
]);

/**
 * 2. Input Khách hàng tạo yêu cầu trả hàng / hoàn tiền
 * POST /api/v1/customer/disputes
 */
export const createDisputeSchema = z.object({
  fulfillmentOrderId: z.string().min(1, 'Mã kiện hàng (fulfillmentOrderId) là bắt buộc'),
  orderItemId: z.string().min(1).optional(),
  reasonCode: z.string().min(1, 'Mã lý do khiếu nại là bắt buộc'),
  description: z.string().min(3, 'Mô tả chi tiết phải có ít nhất 3 ký tự'),
  evidenceUrls: z.array(z.string()).optional().default([]),
  now: z.string().datetime().optional(),
  adminOverride: z.boolean().optional().default(false),
});
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

/**
 * 3. Input Admin ra quyết định Phê duyệt hoặc Bác bỏ khiếu nại
 * POST /api/v1/admin/disputes/:id/decision
 */
export const adminDisputeDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reasonCode: z.string().min(1, 'Lý do quyết định là bắt buộc'),
  note: z.string().optional(),
  instantRefundDemo: z.boolean().optional().default(false),
  sourceRef: z.string().min(1).optional(),
});
export type AdminDisputeDecisionInput = z.infer<typeof adminDisputeDecisionSchema>;

/**
 * 4. Input Khách hàng xác nhận đã gửi hàng hoàn trả cho bưu tá
 * POST /api/v1/customer/disputes/:id/ship-return
 */
export const shipReturnSchema = z.object({
  returnTrackingNo: z.string().optional(),
  sourceRef: z.string().min(1).optional(),
});
export type ShipReturnInput = z.infer<typeof shipReturnSchema>;

/**
 * 5. Input Nhà cung cấp / Kho xác nhận đã nhận lại hàng hoàn -> Kích hoạt hoàn tiền
 * POST /api/v1/supplier/disputes/:id/receive
 */
export const confirmReturnReceivedSchema = z.object({
  sourceRef: z.string().min(1).optional(),
});
export type ConfirmReturnReceivedInput = z.infer<typeof confirmReturnReceivedSchema>;

