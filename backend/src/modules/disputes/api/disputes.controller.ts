import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DisputesService } from '../application/disputes.service';
import {
  createDisputeSchema,
  adminDisputeDecisionSchema,
  shipReturnSchema,
  confirmReturnReceivedSchema,
} from './contracts';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../../common/auth/current-user.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(
    @Inject(DisputesService)
    private readonly disputesService: DisputesService,
  ) {}

  /**
   * 1. GET /api/v1/customer/disputes
   * Khách hàng xem danh sách khiếu nại và các kiện hàng đã giao đủ điều kiện mở khiếu nại
   */
  @Get('customer/disputes')
  @Roles('CUSTOMER', 'ADMIN')
  async getCustomerDisputesOverview(@CurrentUser() actor: CurrentActor) {
    const customerId = actor.role === 'ADMIN' ? 'u-customer-c' : actor.userId;
    return this.disputesService.getCustomerDisputesOverview(customerId);
  }

  /**
   * 2. POST /api/v1/customer/disputes
   * Khách hàng tạo yêu cầu khiếu nại / trả hàng hoàn tiền mới
   */
  @Post('customer/disputes')
  @Roles('CUSTOMER')
  async createCustomerDispute(
    @CurrentUser() actor: CurrentActor,
    @Body() body: unknown,
  ) {
    const parsed = createDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu tạo khiếu nại không hợp lệ',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    return this.disputesService.createCustomerDispute(actor.userId, parsed.data);
  }

  /**
   * 3. GET /api/v1/customer/disputes/:id
   * Khách hàng xem chi tiết một yêu cầu khiếu nại
   */
  @Get('customer/disputes/:id')
  @Roles('CUSTOMER', 'ADMIN')
  async getCustomerDisputeById(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
  ) {
    const customerId = actor.role === 'ADMIN' ? 'u-customer-c' : actor.userId;
    return this.disputesService.getCustomerDisputeById(customerId, id);
  }

  /**
   * 4. POST /api/v1/customer/disputes/:id/ship-return
   * Khách hàng xác nhận đã gửi hàng trả về bưu cục sau khi được Admin duyệt
   */
  @Post('customer/disputes/:id/ship-return')
  @Roles('CUSTOMER')
  async shipReturnItem(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = shipReturnSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu vận đơn hoàn hàng không hợp lệ',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    return this.disputesService.shipReturnItem(
      actor.userId,
      id,
      parsed.data.returnTrackingNo,
    );
  }

  /**
   * 5. GET /api/v1/supplier/disputes
   * Nhà cung cấp xem các yêu cầu trả hàng thuộc kho của mình
   */
  @Get('supplier/disputes')
  @Roles('SUPPLIER', 'ADMIN')
  async getSupplierDisputes(@CurrentUser() actor: CurrentActor) {
    const supplierProfileId = actor.supplierProfileId || 'prof-supp-a';
    return this.disputesService.getSupplierDisputes(supplierProfileId);
  }

  /**
   * 6. POST /api/v1/supplier/disputes/:id/receive
   * Nhà cung cấp xác nhận đã nhận lại hàng hoàn về kho -> Kích hoạt hoàn tiền & đảo bút toán sổ cái
   */
  @Post('supplier/disputes/:id/receive')
  @Roles('SUPPLIER', 'ADMIN')
  async confirmReturnReceived(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = confirmReturnReceivedSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new BadRequestException('Dữ liệu xác nhận hàng hoàn không hợp lệ');
    }
    return this.disputesService.confirmReturnReceived(
      actor.userId,
      actor.role,
      actor.supplierProfileId,
      id,
      parsed.data.sourceRef,
    );
  }

  /**
   * 7. GET /api/v1/admin/disputes
   * Admin lấy toàn bộ danh sách khiếu nại trên sàn để xét duyệt
   */
  @Get('admin/disputes')
  @Roles('ADMIN')
  async getAdminDisputes() {
    return this.disputesService.getAdminDisputes();
  }

  /**
   * 8. POST /api/v1/admin/disputes/:id/decision
   * Admin ra quyết định APPROVED hoặc REJECTED theo hợp đồng docs/contracts/disputes.md
   */
  @Post('admin/disputes/:id/decision')
  @Roles('ADMIN')
  async recordAdminDecision(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = adminDisputeDecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu quyết định khiếu nại không hợp lệ',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    return this.disputesService.recordAdminDecision(actor.userId, id, parsed.data);
  }
}

