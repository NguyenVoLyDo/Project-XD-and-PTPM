import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../common/auth/current-user.decorator';

@Controller('api/v1/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  async getAllProducts(@Query('supplierId') supplierId?: string, @Query('search') search?: string) {
    return this.catalogService.getAllProducts(supplierId, search);
  }

  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.catalogService.getProductById(id);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPPLIER', 'ADMIN')
  async createProduct(
    @CurrentUser() actor: CurrentActor,
    @Body() body: { supplierSku: string; name: string; description: string; costPrice: number; availableStock: number; imageUrl?: string },
  ) {
    return this.catalogService.createProduct(actor.supplierProfileId || 'prof-supp-a', body);
  }

  @Put('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPPLIER', 'ADMIN')
  async updateProduct(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; description: string; costPrice: number; availableStock: number; imageUrl: string; status: any }>,
  ) {
    return this.catalogService.updateProduct(actor.supplierProfileId || 'prof-supp-a', id, body);
  }
}
