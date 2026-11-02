import { Module } from '@nestjs/common';
import { PaymentsController } from './api/payments.controller';
import { PaymentsService } from './application/payments.service';

/**
 * PaymentsModule - Module quản lý nghiệp vụ Thanh toán của dự án DropConnect:
 * - Khởi tạo nghĩa vụ thanh toán lúc Checkout (COD & Online).
 * - Phân bổ tiền (PaymentAllocation) theo từng nhà cung cấp (Supplier).
 * - Nhận và xử lý Webhook mô phỏng từ các cổng thanh toán (VNPay, MoMo).
 * - Xử lý hoàn tiền (Refund) và hủy thu tiền (Void).
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

