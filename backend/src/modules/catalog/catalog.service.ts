import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoreService } from '../../common/database/store.service';
import { Product } from '../../common/database/types';

@Injectable()
export class CatalogService {
  constructor(private readonly store: StoreService) {}

  async getAllProducts(supplierId?: string, search?: string) {
    let list = this.store.products;
    if (supplierId) {
      list = list.filter(p => p.supplierId === supplierId);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.supplierSku.toLowerCase().includes(q));
    }
    return list.map(p => {
      const supp = this.store.supplierProfiles.find(s => s.id === p.supplierId);
      return {
        ...p,
        supplierName: supp?.legalName || 'Nhà cung cấp',
      };
    });
  }

  async getProductById(id: string) {
    const product = this.store.products.find(p => p.id === id);
    if (!product) throw new NotFoundException('Product not found');
    const supp = this.store.supplierProfiles.find(s => s.id === product.supplierId);
    return {
      ...product,
      supplierName: supp?.legalName || 'Nhà cung cấp',
    };
  }

  async createProduct(
    supplierId: string,
    data: { supplierSku: string; name: string; description: string; costPrice: number; availableStock: number; imageUrl?: string },
  ) {
    const supplier = this.store.supplierProfiles.find(s => s.id === supplierId);
    if (!supplier) throw new BadRequestException('Supplier profile not found');
    if (supplier.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Supplier is not approved to create products');
    }

    const skuExists = this.store.products.find(p => p.supplierId === supplierId && p.supplierSku === data.supplierSku);
    if (skuExists) {
      throw new BadRequestException(`SKU ${data.supplierSku} already exists for this supplier`);
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: this.store.generateUuid(),
      supplierId,
      supplierSku: data.supplierSku,
      name: data.name,
      description: data.description,
      costPrice: Math.round(data.costPrice),
      availableStock: Math.max(0, data.availableStock),
      status: data.availableStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
      imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
      createdAt: now,
      updatedAt: now,
    };

    this.store.products.push(newProduct);
    this.store.logAudit(supplier.userId, 'PRODUCT_CREATED', 'PRODUCT', newProduct.id, `Created product ${newProduct.name}`);
    return newProduct;
  }

  async updateProduct(
    supplierId: string,
    productId: string,
    data: Partial<{ name: string; description: string; costPrice: number; availableStock: number; imageUrl: string; status: any }>,
  ) {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.supplierId !== supplierId) {
      throw new ForbiddenException('Cannot edit product of another supplier');
    }

    const oldCostPrice = product.costPrice;

    if (data.name !== undefined) product.name = data.name;
    if (data.description !== undefined) product.description = data.description;
    if (data.imageUrl !== undefined) product.imageUrl = data.imageUrl;
    if (data.status !== undefined) product.status = data.status;
    if (data.availableStock !== undefined) {
      product.availableStock = Math.max(0, data.availableStock);
      if (product.availableStock === 0) product.status = 'OUT_OF_STOCK';
    }

    // Cost price change and Listing revalidation (BR 7.11 & WF-01)
    if (data.costPrice !== undefined && data.costPrice !== oldCostPrice) {
      const newCost = Math.round(data.costPrice);
      product.costPrice = newCost;

      const minMargin = 0.10; // 10%
      const affectedListings = this.store.listings.filter(l => l.productId === productId);

      affectedListings.forEach(listing => {
        const requiredMinPrice = Math.round(newCost * (1 + minMargin));
        if (listing.salePrice < requiredMinPrice) {
          const prevStatus = listing.status;
          listing.status = 'PAUSED_PRICE_MISMATCH';
          listing.visible = false;

          // Notify shop owner
          const shop = this.store.shops.find(s => s.id === listing.shopId);
          const seller = this.store.sellerProfiles.find(s => s.id === shop?.sellerId);
          if (seller) {
            this.store.sendNotification(
              seller.userId,
              'Cảnh báo: Listing bị tạm ẩn do giá vốn tăng!',
              `Sản phẩm "${product.name}" có giá vốn mới (${newCost.toLocaleString()} đ) khiến giá bán lẻ của bạn (${listing.salePrice.toLocaleString()} đ) dưới biên lợi nhuận tối thiểu 10%. Vui lòng tăng giá bán để kích hoạt lại!`,
              'WARNING',
            );
          }

          this.store.logAudit(
            supplierId,
            'LISTING_PAUSED_BY_POLICY',
            'LISTING',
            listing.id,
            `Cost price increased from ${oldCostPrice} to ${newCost}. Status changed from ${prevStatus} to PAUSED_PRICE_MISMATCH`,
          );
        }
      });
    }

    product.updatedAt = new Date().toISOString();
    this.store.logAudit(supplierId, 'PRODUCT_UPDATED', 'PRODUCT', product.id, `Product updated`);
    return product;
  }
}
