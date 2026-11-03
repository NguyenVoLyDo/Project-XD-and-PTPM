import { z } from 'zod';

/**
 * 1. Trạng thái đối soát của từng đơn con (Settlement Status)
 * Theo docs/contracts/settlements.md & docs/mermaid/09-settlement-state.mmd
 */
export const settlementStatusSchema = z.enum([
  'HOLD',           // Đang tạm giữ trong 7 ngày đổi trả (hoặc đang có khiếu nại mở)
  'ELIGIBLE',       // Đã qua 7 ngày đổi trả & không có khiếu nại -> đủ điều kiện chi trả
  'CALCULATED',     // Đã chốt số liệu công nợ NCC & hoa hồng Seller
  'PAYOUT_PENDING', // Đang trong đợt giải ngân
  'PAID',           // Đã giải ngân thành công (Mock Payout)
  'REVERSED',       // Đã đảo ngược bút toán do hoàn tiền / khiếu nại thắng về phía khách
]);
export type SettlementContractStatus = z.infer<typeof settlementStatusSchema>;

/**
 * 2. Sổ cái kế toán kép (Double-Entry Financial Ledger)
 * Mỗi nghiệp vụ tạo 1 group có Tổng DEBIT = Tổng CREDIT (số nguyên dương VND, append-only)
 */
export const ledgerDirectionSchema = z.enum(['DEBIT', 'CREDIT']);
export type LedgerDirection = z.infer<typeof ledgerDirectionSchema>;

export const ledgerAccountCodeSchema = z.enum([
  'ESCROW_CASH',      // Tiền khách thanh toán sàn đang giữ hộ
  'SUPPLIER_PAYABLE', // Phải trả tiền vốn gốc cho Nhà cung cấp
  'SELLER_PAYABLE',   // Phải trả lợi nhuận/hoa hồng cho Seller
  'PLATFORM_REVENUE', // Doanh thu phí hoa hồng sàn
  'BANK_OUTFLOW',     // Tiền chi ra qua ngân hàng khi Payout
  'CUSTOMER_REFUND',  // Tiền hoàn trả lại cho Khách hàng
]);
export type LedgerAccountCode = z.infer<typeof ledgerAccountCodeSchema>;

export const doubleEntryLegSchema = z.object({
  id: z.string(),
  settlementId: z.string(),
  fulfillmentOrderId: z.string(),
  transactionGroupRef: z.string().min(1),
  accountCode: ledgerAccountCodeSchema,
  direction: ledgerDirectionSchema,
  amountVnd: z.number().int().positive(),
  currency: z.literal('VND'),
  sourceRef: z.string().min(1), // unique: `${businessSourceRef}:${legIndex}`
  description: z.string(),
  postedAt: z.string(),
});
export type DoubleEntryLeg = z.infer<typeof doubleEntryLegSchema>;

/**
 * 3. Input đánh giá điều kiện mở đối soát (Settlement.evaluateEligibility)
 */
export const evaluateEligibilitySchema = z.object({
  now: z.string().datetime().optional(),
  fastForwardDemo: z.boolean().optional().default(false),
  sourceRef: z.string().min(1).optional(),
});
export type EvaluateEligibilityInput = z.infer<typeof evaluateEligibilitySchema>;

/**
 * 4. Input ghi nhận điều chỉnh / hoàn tiền (Settlement.recordAdjustment)
 */
export const recordAdjustmentSchema = z.object({
  allocationId: z.string().min(1),
  amount: z.number().int().positive(),
  reasonCode: z.string().min(1),
  sourceRef: z.string().min(1),
});
export type RecordAdjustmentInput = z.infer<typeof recordAdjustmentSchema>;

/**
 * 5. Input giải ngân mô phỏng (Mock Payout)
 */
export const executePayoutSchema = z.object({
  sourceRef: z.string().min(1).optional(),
  simulateFailure: z.boolean().optional().default(false),
});
export type ExecutePayoutInput = z.infer<typeof executePayoutSchema>;

