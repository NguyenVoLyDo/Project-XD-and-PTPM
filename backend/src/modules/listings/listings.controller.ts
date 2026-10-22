import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, CurrentActor } from '../../common/auth/current-user.decorator';

@Controller('api/v1/listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async getPublicListings(@Query('shopId') shopId?: string, @Query('search') search?: string) {
    return this.listingsService.getPublicListings(shopId, search);
  }

  @Get('seller/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async getSellerListings(@CurrentUser() actor: CurrentActor) {
    return this.listingsService.getSellerListings(actor.sellerProfileId || 'prof-sell-x');
  }

  @Get('seller/shops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async getSellerShops(@CurrentUser() actor: CurrentActor) {
    return this.listingsService.getSellerShops(actor.sellerProfileId || 'prof-sell-x');
  }

  @Post('seller/shops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async createShop(@CurrentUser() actor: CurrentActor, @Body() body: { name: string }) {
    return this.listingsService.createShop(actor.sellerProfileId || 'prof-sell-x', body.name);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  async createListing(
    @CurrentUser() actor: CurrentActor,
    @Body() body: { shopId: string; productId: string; sellerSku?: string; salePrice: number; visible?: boolean },
  ) {
    return this.listingsService.createListing(actor.sellerProfileId || 'prof-sell-x', body);
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
    return this.listingsService.updateListing(actor.sellerProfileId || 'prof-sell-x', id, body);
  }
}
