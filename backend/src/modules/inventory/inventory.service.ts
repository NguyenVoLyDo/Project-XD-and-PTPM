import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StoreService } from '../../common/database/store.service';
import { StockReservation } from '../../common/database/types';

@Injectable()
export class InventoryService {
  constructor(private readonly store: StoreService) {}

  async getProductStock(productId: string) {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) throw new NotFoundException('Product not found');

    const heldQuantity = this.store.stockReservations
      .filter(r => r.productId === productId && r.status === 'HELD' && new Date(r.expiresAt) > new Date())
      .reduce((sum, r) => sum + r.quantity, 0);

    const availableForSale = Math.max(0, product.availableStock - heldQuantity);

    return {
      productId: product.id,
      name: product.name,
      totalStock: product.availableStock,
      heldQuantity,
      availableForSale,
    };
  }

  async updateSupplierStock(supplierId: string, productId: string, newStock: number) {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.supplierId !== supplierId) throw new BadRequestException('Product does not belong to this supplier');

    if (newStock < 0) throw new BadRequestException('Stock cannot be negative');

    product.availableStock = newStock;
    product.status = newStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK';
    product.updatedAt = new Date().toISOString();

    // Revalidate listings referencing this product
    this.store.listings.forEach(listing => {
      if (listing.productId === productId) {
        if (newStock === 0 && listing.status === 'ACTIVE') {
          listing.status = 'PAUSED_OUT_OF_STOCK';
        } else if (newStock > 0 && listing.status === 'PAUSED_OUT_OF_STOCK') {
          listing.status = 'ACTIVE';
        }
      }
    });

    this.store.logAudit(supplierId, 'STOCK_UPDATED', 'PRODUCT', productId, `Stock updated to ${newStock}`);
    return product;
  }

  async holdStock(productId: string, quantity: number, orderItemId: string, ttlMinutes = 15): Promise<StockReservation> {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const held = this.store.stockReservations
      .filter(r => r.productId === productId && r.status === 'HELD' && new Date(r.expiresAt) > new Date())
      .reduce((sum, r) => sum + r.quantity, 0);

    const effectiveAvailable = product.availableStock - held;
    if (effectiveAvailable < quantity) {
      throw new BadRequestException(`INSUFFICIENT_STOCK: Product ${product.name} only has ${effectiveAvailable} available, requested ${quantity}`);
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const reservation: StockReservation = {
      id: this.store.generateUuid(),
      orderItemId,
      productId,
      quantity,
      status: 'HELD',
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.store.stockReservations.push(reservation);
    return reservation;
  }

  async commitStock(reservationId: string) {
    const res = this.store.stockReservations.find(r => r.id === reservationId);
    if (!res) throw new NotFoundException(`Reservation ${reservationId} not found`);
    if (res.status === 'COMMITTED') return res; // idempotent
    if (res.status === 'RELEASED') throw new BadRequestException('Cannot commit an already released reservation');

    const product = this.store.products.find(p => p.id === res.productId);
    if (product) {
      product.availableStock = Math.max(0, product.availableStock - res.quantity);
      if (product.availableStock === 0) product.status = 'OUT_OF_STOCK';
      product.updatedAt = new Date().toISOString();
    }

    res.status = 'COMMITTED';
    this.store.logAudit('system', 'STOCK_COMMITTED', 'STOCK_RESERVATION', reservationId, `Committed ${res.quantity} units for product ${res.productId}`);
    return res;
  }

  async releaseStock(reservationId: string) {
    const res = this.store.stockReservations.find(r => r.id === reservationId);
    if (!res) throw new NotFoundException(`Reservation ${reservationId} not found`);
    if (res.status === 'RELEASED') return res; // idempotent

    res.status = 'RELEASED';
    this.store.logAudit('system', 'STOCK_RELEASED', 'STOCK_RESERVATION', reservationId, `Released ${res.quantity} units for product ${res.productId}`);
    return res;
  }
}
