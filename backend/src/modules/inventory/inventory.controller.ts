import { Controller, Get, Patch, Param, Body, UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../common/auth/current-user.decorator';

function getSupplierProfileId(actor: CurrentActor): string {
  const id = actor?.activeProfileId || actor?.supplierProfileId || (process.env.DEMO_AUTH_ENABLED === 'true' && actor?.activeRole === 'SUPPLIER' ? 'prof-supp-a' : undefined);
  if (!id) {
    throw new ForbiddenException('ACTIVE_ROLE_REQUIRED: Cần hồ sơ Nhà cung cấp được duyệt');
  }
  return id;
}

@Controller('api/v1/inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventoryService: InventoryService) {}

  @Get('product/:productId')
  async getProductStock(@Param('productId') productId: string) {
    return this.inventoryService.getProductStock(productId);
  }

  @Patch('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPPLIER', 'ADMIN')
  async updateStock(
    @CurrentUser() actor: CurrentActor,
    @Param('productId') productId: string,
    @Body() body: { availableStock: number },
  ) {
    return this.inventoryService.updateSupplierStock(getSupplierProfileId(actor), productId, body.availableStock);
  }
}
