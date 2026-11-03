import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../common/auth/current-user.decorator';

function getSellerProfileId(actor: CurrentActor): string {
  const id = actor?.activeProfileId || actor?.sellerProfileId || (process.env.DEMO_AUTH_ENABLED === 'true' && actor?.activeRole === 'SELLER' ? 'prof-sell-x' : undefined);
  if (!id) {
    throw new ForbiddenException('ACTIVE_ROLE_REQUIRED: Cần hồ sơ Người bán (Seller) được duyệt');
  }
  return id;
}

@Controller('api/v1/listings')
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listingsService: ListingsService) {}

  @Get()
  async getPublicListings(@Query('shopId') shopId?: string, @Query('search') search?: string) {
    return this.listingsService.getPublicListings(shopId, search);
  }

  @Get('seller/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async getSellerListings(@CurrentUser() actor: CurrentActor) {
    return this.listingsService.getSellerListings(getSellerProfileId(actor));
  }

  @Get('page')
  async getPage(@Query() query: { page?: string; limit?: string; supplierId?: string; search?: string; sort?: string }) {
    const all = await this.listingsService.getPublicListings();
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    const rows = all.filter(r => (!query.supplierId || r.supplierId === query.supplierId) && (!query.search || normalize(r.productName + ' ' + r.shopName).includes(normalize(query.search))));
    if (query.sort === 'price-asc') rows.sort((a,b) => a.salePrice-b.salePrice);
    if (query.sort === 'price-desc') rows.sort((a,b) => b.salePrice-a.salePrice);
    const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
    return { items: rows.slice((page-1)*limit,page*limit), total: rows.length, page, limit, totalPages: Math.max(1,Math.ceil(rows.length/limit)), suppliers: [...new Map(all.map(r => [r.supplierId, { id:r.supplierId, name:r.supplierName }])).values()] };
  }

  @Get('seller/shops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async getSellerShops(@CurrentUser() actor: CurrentActor) {
    return this.listingsService.getSellerShops(getSellerProfileId(actor));
  }

  @Post('seller/shops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async createShop(@CurrentUser() actor: CurrentActor, @Body() body: { name: string }) {
    return this.listingsService.createShop(getSellerProfileId(actor), body.name);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async createListing(
    @CurrentUser() actor: CurrentActor,
    @Body() body: { shopId: string; productId: string; sellerSku?: string; salePrice: number; visible?: boolean },
  ) {
    return this.listingsService.createListing(getSellerProfileId(actor), body);
  }

  @Get(':id')
  async getListingById(@Param('id') id: string) {
    return this.listingsService.getListingById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async updateListing(
    @CurrentUser() actor: CurrentActor,
    @Param('id') id: string,
    @Body() body: Partial<{ salePrice: number; visible: boolean; status: any }>,
  ) {
    return this.listingsService.updateListing(getSellerProfileId(actor), id, body);
  }
}
