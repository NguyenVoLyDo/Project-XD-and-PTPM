import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommerceService } from './commerce.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentActor } from '../../common/auth/current-actor.interface';

@Controller('api/v1')
export class CommerceController {
  constructor(@Inject(CommerceService) private readonly service: CommerceService) {}
  @Get('catalog/products') publicProducts(@Query('supplierId') id?:string,@Query('search') search?:string) { return this.service.products(id,search); }
  @Get(['catalog/products/:id','products/:id']) product(@Param('id') id:string) { return this.service.product(id); }
  @Get('supplier/products') @UseGuards(JwtAuthGuard) own(@CurrentUser() a:CurrentActor) { return this.service.products(undefined,undefined,a); }
  @Get('seller/catalog/products') @UseGuards(JwtAuthGuard) sourcing(@CurrentUser() a:CurrentActor) { return this.service.sourcing(a); }
  @Get('supplier/products/:id') @UseGuards(JwtAuthGuard) async ownProduct(@CurrentUser() a:CurrentActor,@Param('id') id:string) { await this.service.ownedProduct(a,id); return (await this.service.products(undefined,undefined,a)).find(p=>p.id===id); }
  @Post('supplier/products') @UseGuards(JwtAuthGuard) create(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createProduct(a,b); }
  @Post('catalog/products') @UseGuards(JwtAuthGuard) legacyCreate(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createProduct(a,b,true); }
  @Patch('supplier/products/:id') @UseGuards(JwtAuthGuard) patch(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.updateProduct(a,id,b); }
  @Put('catalog/products/:id') @UseGuards(JwtAuthGuard) legacyPatch(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.updateProduct(a,id,b); }
  @Get('supplier/inventory/products/:id') @UseGuards(JwtAuthGuard) async stock(@CurrentUser() a:CurrentActor,@Param('id') id:string) { await this.service.ownedProduct(a,id); return this.service.stock(id); }
  @Post('supplier/inventory/adjustments') @UseGuards(JwtAuthGuard) adjust(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.adjust(a,b); }
  @Patch('inventory/product/:id') @UseGuards(JwtAuthGuard) legacyStock(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.adjust(a,{...b,productId:id},true); }
  @Get(['listings/seller/shops','seller/shops']) @UseGuards(JwtAuthGuard) shops(@CurrentUser() a:CurrentActor) { return this.service.shops(a); }
  @Post('seller/shops') @UseGuards(JwtAuthGuard) shop(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createShop(a,b); }
  @Post('listings/seller/shops') @UseGuards(JwtAuthGuard) legacyShop(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createShop(a,b,true); }
  @Patch('seller/shops/:id') @UseGuards(JwtAuthGuard) patchShop(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.updateShop(a,id,b); }
  @Get(['listings/seller/mine','seller/listings']) @UseGuards(JwtAuthGuard) mine(@CurrentUser() a:CurrentActor) { return this.service.listings(undefined,undefined,a); }
  @Get('listings') listings(@Query('shopId') id?:string,@Query('search') search?:string) { return this.service.listings(id,search); }
  @Get('listings/:id') listing(@Param('id') id:string) { return this.service.listings(undefined,undefined,undefined,id); }
  @Post('seller/listings') @UseGuards(JwtAuthGuard) createListing(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createListing(a,b); }
  @Post('listings') @UseGuards(JwtAuthGuard) legacyListing(@CurrentUser() a:CurrentActor,@Body() b:any) { return this.service.createListing(a,b,true); }
  @Patch('seller/listings/:id') @UseGuards(JwtAuthGuard) patchListing(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.updateListing(a,id,b); }
  @Put('listings/:id') @UseGuards(JwtAuthGuard) legacyPatchListing(@CurrentUser() a:CurrentActor,@Param('id') id:string,@Body() b:any) { return this.service.updateListing(a,id,b); }
  @Post('seller/listings/:id/publish') @UseGuards(JwtAuthGuard) publish(@CurrentUser() a:CurrentActor,@Param('id') id:string) { return this.service.updateListing(a,id,{},true); }
}
