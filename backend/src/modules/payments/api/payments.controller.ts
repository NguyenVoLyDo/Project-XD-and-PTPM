import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
  Query,
  Optional,
} from '@nestjs/common';
import { PaymentsService } from '../application/payments.service';
import { PaymentReconciliationService } from '../application/payment-reconciliation.service';
import { WebhookLogService } from '../application/webhook-log.service';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../../common/auth/current-user.decorator';
import { Public } from '../../../common/auth/public.decorator';
import {
  createPaymentObligationSchema,
  paymentWebhookPayloadSchema,
  type CreatePaymentObligationInput,
  type PaymentWebhookPayload,
} from './contracts';

@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
    @Optional()
    @Inject(PaymentReconciliationService)
    private readonly reconciliationService?: PaymentReconciliationService,
    @Optional()
    @Inject(WebhookLogService)
    private readonly webhookLogService?: WebhookLogService,
  ) {}

  /**
   * 1. GET /api/v1/payments/reconciliation/report
   * Đối soát tài chính và giao dịch toàn sàn (Chỉ Admin).
   */
  @Get('reconciliation/report')
  @Roles('ADMIN')
  async getReconciliationReport() {
    if (!this.reconciliationService) {
      return { message: 'Reconciliation service not enabled' };
    }
    return this.reconciliationService.runReconciliation();
  }

  /**
   * 2. GET /api/v1/payments/reconciliation/orders/:orderId
   * Đối soát chi tiết từng đơn hàng (Chỉ Admin).
   */
  @Get('reconciliation/orders/:orderId')
  @Roles('ADMIN')
  async reconcileOrder(@Param('orderId') orderId: string) {
    if (!this.reconciliationService) {
      return { message: 'Reconciliation service not enabled' };
    }
    return this.reconciliationService.reconcileOrder(orderId);
  }

  /**
   * 3. GET /api/v1/payments/webhooks/history
   * Xem lịch sử nhận webhook để audit (Chỉ Admin).
   */
  @Get('webhooks/history')
  @Roles('ADMIN')
  async getWebhookHistory(@Query('limit') limit = 50) {
    if (!this.webhookLogService) {
      return [];
    }
    return this.webhookLogService.getRecentLogs(Number(limit) || 50);
  }

  /**
   * 4. GET /api/v1/payments/:id
   * Tra cứu chi tiết thông tin thanh toán và các khoản phân bổ đơn con.
   * Yêu cầu xác thực JWT và kiểm tra quyền sở hữu (Customer/Supplier/Seller/Admin).
   */
  @Get(':id')
  @Roles('ADMIN', 'CUSTOMER', 'SELLER', 'SUPPLIER')
  async getPaymentById(
    @Param('id') paymentId: string,
    @CurrentUser() actor: CurrentActor,
  ) {
    return this.paymentsService.getPaymentById(paymentId, actor);
  }

  /**
   * 2. POST /api/v1/payments/obligation
   * Tạo nghĩa vụ thanh toán lúc Checkout.
   */
  @Post('obligation')
  @Roles('CUSTOMER', 'ADMIN')
  async createObligation(@Body() body: unknown) {
    // Validate dữ liệu đầu vào bằng Zod schema
    const parsedInput = createPaymentObligationSchema.parse(body);
    return this.paymentsService.createCheckoutObligation(parsedInput);
  }

  /**
   * 3. POST /api/v1/payments/webhooks/:provider
   * Cổng thanh toán (Mô phỏng VNPay/MoMo) gọi vào đây để báo kết quả thanh toán.
   * 
   * LƯU Ý CHO VẤN ĐÁP:
   * Endpoint này KHÔNG dùng JwtAuthGuard vì cổng thanh toán là server bên ngoài gọi đến,
   * họ không có token của người dùng mà xác thực qua chữ ký số bí mật (Signature) trong payload.
   */
  @Post('webhooks/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() body: Record<string, any>,
  ) {
    // Đảm bảo provider trong url khớp với body
    const payloadWithProvider = {
      ...body,
      provider: provider.toUpperCase(),
    };

    const parsedPayload = paymentWebhookPayloadSchema.parse(payloadWithProvider);
    return this.paymentsService.handleWebhook(parsedPayload);
  }

  /**
   * 4. POST /api/v1/payments/allocations/:id/refund
   * Xử lý hoàn tiền cho 1 đơn con khi có khiếu nại hoặc hủy đơn (Chỉ Admin).
   */
  @Post('allocations/:id/refund')
  @Roles('ADMIN')
  async refundAllocation(
    @Param('id') allocationId: string,
    @Body() body: { amount: number; reasonCode: string; sourceRef: string },
  ) {
    return this.paymentsService.refundAllocation(
      allocationId,
      body.amount,
      body.reasonCode || 'CUSTOMER_RETURN',
      body.sourceRef || 'ADMIN_DISPUTE_REF',
    );
  }


}

