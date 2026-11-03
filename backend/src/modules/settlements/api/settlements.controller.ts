import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { SettlementsService } from '../application/settlements.service';
import {
  evaluateEligibilitySchema,
  executePayoutSchema,
} from './contracts';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../../common/auth/current-user.decorator';
import { StoreService } from '../../../common/database/store.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(
    @Inject(SettlementsService)
    private readonly settlementsService: SettlementsService,
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  /**
   * Kiểm tra quyền sở hữu đối với khoản đối soát (Ownership check)
   */
  private verifyOwnership(actor: CurrentActor, settlementOrFoId: string) {
    if (actor.role === 'ADMIN') return;

    const settlement = this.store.settlements.find(
      (s) => s.id === settlementOrFoId || s.fulfillmentOrderId === settlementOrFoId,
    );
    const foId = settlement ? settlement.fulfillmentOrderId : settlementOrFoId;
    const fo = this.store.fulfillmentOrders.find((f) => f.id === foId);

    if (!fo) {
      throw new NotFoundException('Không tìm thấy đơn hàng đối soát');
    }

    if (actor.role === 'SUPPLIER' && fo.supplierId !== actor.supplierProfileId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên khoản đối soát của Nhà cung cấp khác');
    }

    if (actor.role === 'SELLER' && fo.sellerId !== actor.sellerProfileId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên khoản đối soát của Gian hàng khác');
    }
  }

  /**
   * 1. GET /api/v1/supplier/finance
   * Lấy bảng đối soát công nợ & sổ cái tài chính dành cho Nhà cung cấp
   */
  @Get('supplier/finance')
  @Roles('SUPPLIER', 'ADMIN')
  async getSupplierFinance(
    @CurrentUser() actor: CurrentActor,
    @Query('supplierProfileId') querySupplierId?: string,
  ) {
    const profileId =
      actor.role === 'ADMIN'
        ? querySupplierId || actor.supplierProfileId || 'prof-supp-a'
        : actor.supplierProfileId!;
    return this.settlementsService.getSupplierFinance(profileId);
  }

  /**
   * 2. GET /api/v1/seller/finance
   * Lấy bảng đối soát lợi nhuận bán hàng & sổ cái dành cho Seller (ẩn giá vốn NCC)
   */
  @Get('seller/finance')
  @Roles('SELLER', 'ADMIN')
  async getSellerFinance(
    @CurrentUser() actor: CurrentActor,
    @Query('sellerProfileId') querySellerId?: string,
  ) {
    const profileId =
      actor.role === 'ADMIN'
        ? querySellerId || actor.sellerProfileId || 'prof-sell-x'
        : actor.sellerProfileId!;
    return this.settlementsService.getSellerFinance(profileId);
  }

  /**
   * 3. POST /api/v1/settlements/:id/evaluate
   * Đánh giá điều kiện chuyển HOLD -> ELIGIBLE (hoặc mô phỏng qua 7 ngày đổi trả khi demo)
   */
  @Post('settlements/:id/evaluate')
  @Roles('SUPPLIER', 'SELLER', 'ADMIN')
  async evaluateEligibility(
    @CurrentUser() actor: CurrentActor,
    @Param('id') settlementOrFoId: string,
    @Body() body: unknown,
  ) {
    this.verifyOwnership(actor, settlementOrFoId);

    const parsed = evaluateEligibilitySchema.safeParse(body || {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu đánh giá đối soát không hợp lệ',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    return this.settlementsService.evaluateEligibility(
      settlementOrFoId,
      parsed.data.now,
      parsed.data.sourceRef,
      parsed.data.fastForwardDemo,
    );
  }

  /**
   * 4. POST /api/v1/settlements/:id/payout
   * Giải ngân mô phỏng (Mock Payout) chuyển trạng thái sang PAID
   */
  @Post('settlements/:id/payout')
  @Roles('SUPPLIER', 'SELLER', 'ADMIN')
  async executePayout(
    @CurrentUser() actor: CurrentActor,
    @Param('id') settlementId: string,
    @Body() body: unknown,
  ) {
    this.verifyOwnership(actor, settlementId);

    const parsed = executePayoutSchema.safeParse(body || {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dữ liệu yêu cầu giải ngân không hợp lệ',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    return this.settlementsService.executePayout(
      settlementId,
      parsed.data.sourceRef,
      parsed.data.simulateFailure,
      actor.userId,
    );
  }
}

