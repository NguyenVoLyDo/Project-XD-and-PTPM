import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoreService } from '../../common/database/store.service';
import { Listing, Shop } from '../../common/database/types';

@Injectable()
export class ListingsService {
  constructor(private readonly store: StoreService) {}

  async getPublicListings(shopId?: string, search?: string) {
    let list = this.store.listings.filter(l => l.status === 'ACTIVE' && l.visible);
    if (shopId) {
      list = list.filter(l => l.shopId === shopId);
    }

    return list.map(l => this.enrichListing(l)).filter(item => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        item.shopName.toLowerCase().includes(q) ||
        item.sellerSku.toLowerCase().includes(q)
      );
    });
  }

  async getListingById(id: string) {
    const listing = this.store.listings.find(l => l.id === id);
    if (!listing) throw new NotFoundException('Listing not found');
    return this.enrichListing(listing);
  }

  private enrichListing(l: Listing) {
    const product = this.store.products.find(p => p.id === l.productId);
    const shop = this.store.shops.find(s => s.id === l.shopId);
    const supplier = this.store.supplierProfiles.find(s => s.id === product?.supplierId);
    const seller = this.store.sellerProfiles.find(s => s.id === shop?.sellerId);

    const heldStock = this.store.stockReservations
      .filter(r => r.productId === product?.id && r.status === 'HELD' && new Date(r.expiresAt) > new Date())
      .reduce((sum, r) => sum + r.quantity, 0);

    const effectiveStock = Math.max(0, (product?.availableStock || 0) - heldStock);

    return {
      ...l,
      productName: product?.name || 'Sản phẩm',
      productDescription: product?.description || '',
      productImage: product?.imageUrl || '',
      costPrice: product?.costPrice || 0,
      availableStock: effectiveStock,
      shopName: shop?.name || 'Cửa hàng',
      supplierName: supplier?.legalName || 'Nhà cung cấp',
      sellerName: seller?.displayName || 'Người bán',
      supplierId: product?.supplierId,
      sellerId: seller?.id,
    };
  }

  async getSellerShops(sellerId: string) {
    return this.store.shops.filter(s => s.sellerId === sellerId);
  }

  async createShop(sellerId: string, name: string) {
    const seller = this.store.sellerProfiles.find(s => s.id === sellerId);
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (seller.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Seller account is not approved yet');
    }

    const newShop: Shop = {
      id: this.store.generateUuid(),
      sellerId,
      name,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.shops.push(newShop);
    this.store.logAudit(seller.userId, 'SHOP_CREATED', 'SHOP', newShop.id, `Created shop ${name}`);
    return newShop;
  }

  async getSellerListings(sellerId: string) {
    const shops = this.store.shops.filter(s => s.sellerId === sellerId);
    const shopIds = shops.map(s => s.id);
    const listings = this.store.listings.filter(l => shopIds.includes(l.shopId));
    return listings.map(l => this.enrichListing(l));
  }

  async createListing(
    sellerId: string,
    data: { shopId: string; productId: string; sellerSku?: string; salePrice: number; visible?: boolean },
  ) {
    const seller = this.store.sellerProfiles.find(s => s.id === sellerId);
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (seller.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Seller account must be approved before creating listings');
    }

    const shop = this.store.shops.find(s => s.id === data.shopId && s.sellerId === sellerId);
    if (!shop) throw new BadRequestException('Shop not found or not owned by seller');

    const product = this.store.products.find(p => p.id === data.productId);
    if (!product) throw new NotFoundException('Product not found in catalog');
    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot list an inactive or out of stock product');
    }

    // Min margin constraint: salePrice >= costPrice * (1 + 0.10)
    const minMargin = 0.10;
    const requiredMinPrice = Math.round(product.costPrice * (1 + minMargin));
    if (data.salePrice < requiredMinPrice) {
      throw new BadRequestException(
        `SALE_PRICE_BELOW_MIN_MARGIN: Giá bán lẻ (${data.salePrice.toLocaleString()} đ) phải tối thiểu là ${requiredMinPrice.toLocaleString()} đ (đảm bảo biên lợi nhuận >= 10% so với giá vốn ${product.costPrice.toLocaleString()} đ)`,
      );
    }

    const newListing: Listing = {
      id: this.store.generateUuid(),
      productId: data.productId,
      shopId: data.shopId,
      sellerSku: data.sellerSku || `SKU-${Date.now().toString().slice(-6)}`,
      salePrice: Math.round(data.salePrice),
      status: 'ACTIVE',
      visible: data.visible !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.listings.push(newListing);
    this.store.logAudit(seller.userId, 'LISTING_CREATED', 'LISTING', newListing.id, `Created listing for ${product.name} at ${newListing.salePrice} VND`);
    return this.enrichListing(newListing);
  }

  async updateListing(
    sellerId: string,
    listingId: string,
    data: Partial<{ salePrice: number; visible: boolean; status: any }>,
  ) {
    const listing = this.store.listings.find(l => l.id === listingId);
    if (!listing) throw new NotFoundException('Listing not found');

    const shop = this.store.shops.find(s => s.id === listing.shopId && s.sellerId === sellerId);
    if (!shop) throw new ForbiddenException('Cannot edit listing of another shop');

    const product = this.store.products.find(p => p.id === listing.productId);

    if (data.salePrice !== undefined && product) {
      const minMargin = 0.10;
      const requiredMinPrice = Math.round(product.costPrice * (1 + minMargin));
      if (data.salePrice < requiredMinPrice) {
        throw new BadRequestException(
          `SALE_PRICE_BELOW_MIN_MARGIN: Giá bán mới (${data.salePrice.toLocaleString()} đ) dưới mức tối thiểu ${requiredMinPrice.toLocaleString()} đ`,
        );
      }
      listing.salePrice = Math.round(data.salePrice);

      // If it was paused due to price mismatch, reactivate it!
      if (listing.status === 'PAUSED_PRICE_MISMATCH') {
        listing.status = 'ACTIVE';
        listing.visible = true;
      }
    }

    if (data.visible !== undefined) listing.visible = data.visible;
    if (data.status !== undefined) listing.status = data.status;

    listing.updatedAt = new Date().toISOString();
    return this.enrichListing(listing);
  }
}
