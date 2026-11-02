import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { FulfillmentService } from '../application/fulfillment.service';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../../common/auth/current-user.decorator';

@Controller('api/v1/supplier/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPPLIER', 'ADMIN')
export class FulfillmentController {
  constructor(
    @Inject(FulfillmentService)
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  /**
   * 1. GET /api/v1/supplier/orders
   * Lấy danh sách các đơn con thuộc về Nhà cung cấp đang đăng nhập.
   */
  @Get()
  async getSupplierOrders(@CurrentUser() actor: CurrentActor) {
    const supplierProfileId = actor?.supplierProfileId || 'prof-supp-a';
    return this.fulfillmentService.getSupplierOrders(supplierProfileId);
  }

  /**
   * 2. POST /api/v1/supplier/orders/:id/accept
   * Nhà cung cấp bấm "Tiếp nhận đơn hàng"
   */
  @Post(':id/accept')
  async acceptOrder(
    @CurrentUser() actor: CurrentActor,
    @Param('id') fulfillmentOrderId: string,
  ) {
    const supplierProfileId = actor?.supplierProfileId || 'prof-supp-a';
    return this.fulfillmentService.acceptOrder(supplierProfileId, fulfillmentOrderId);
  }

  /**
   * 3. POST /api/v1/supplier/orders/:id/ship
   * Nhà cung cấp bấm "Giao cho bưu tá" (nhập mã vận đơn)
   */
  @Post(':id/ship')
  async shipOrder(
    @CurrentUser() actor: CurrentActor,
    @Param('id') fulfillmentOrderId: string,
    @Body() body: { carrierCode?: string; trackingNo?: string },
  ) {
    const supplierProfileId = actor?.supplierProfileId || 'prof-supp-a';
    return this.fulfillmentService.shipOrder(
      supplierProfileId,
      fulfillmentOrderId,
      body.carrierCode || 'GHN_EXPRESS',
      body.trackingNo,
    );
  }

  /**
   * 4. POST /api/v1/supplier/orders/:id/deliver
   * Xác nhận giao hàng thành công
   */
  @Post(':id/deliver')
  async deliverOrder(
    @CurrentUser() actor: CurrentActor,
    @Param('id') fulfillmentOrderId: string,
  ) {
    const supplierProfileId = actor?.supplierProfileId || 'prof-supp-a';
    return this.fulfillmentService.deliverOrder(supplierProfileId, fulfillmentOrderId);
  }

  /**
   * 5. POST /api/v1/supplier/orders/:id/reject
   * Nhà cung cấp từ chối đơn hàng (hết hàng)
   */
  @Post(':id/reject')
  async rejectOrder(
    @CurrentUser() actor: CurrentActor,
    @Param('id') fulfillmentOrderId: string,
    @Body() body: { reasonCode?: string },
  ) {
    const supplierProfileId = actor?.supplierProfileId || 'prof-supp-a';
    return this.fulfillmentService.rejectOrder(
      supplierProfileId,
      fulfillmentOrderId,
      body.reasonCode || 'OUT_OF_STOCK',
    );
  }
}

