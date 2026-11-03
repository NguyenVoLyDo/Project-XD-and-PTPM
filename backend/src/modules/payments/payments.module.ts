import { Module } from '@nestjs/common';
import { PaymentsController } from './api/payments.controller';
import { PaymentsService } from './application/payments.service';
import { PaymentReconciliationService } from './application/payment-reconciliation.service';
import { WebhookLogService } from './application/webhook-log.service';
import { MockPaymentProviderAdapter } from './infrastructure/mock-payment-provider.adapter';

/**
 * PaymentsModule - Module quản lý nghiệp vụ Thanh toán của dự án DropConnect:
 * - Khởi tạo nghĩa vụ thanh toán lúc Checkout (COD & Online).
 * - Phân bổ tiền (PaymentAllocation) theo từng nhà cung cấp (Supplier).
 * - Kiến trúc Provider độc lập (IPaymentProvider, MockPaymentProviderAdapter).
 * - Nhận và xử lý Webhook an toàn (HMAC-SHA256, timingSafeEqual, chống replay).
 * - Đối soát giao dịch và doanh thu (PaymentReconciliationService).
 * - Xử lý hoàn tiền (Refund) và hủy thu tiền (Void).
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentReconciliationService,
    WebhookLogService,
    MockPaymentProviderAdapter,
    {
      provide: 'PAYMENT_PROVIDER',
      useClass: MockPaymentProviderAdapter,
    },
  ],
  exports: [
    PaymentsService,
    PaymentReconciliationService,
    WebhookLogService,
    MockPaymentProviderAdapter,
  ],
})
export class PaymentsModule {}

