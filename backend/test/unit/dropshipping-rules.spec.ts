import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../../src/common/database/store.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { CatalogService } from '../../src/modules/catalog/catalog.service';
import { ListingsService } from '../../src/modules/listings/listings.service';

describe('Thành viên 2 — Catalog, Listings & Inventory Business Rules', () => {
  let store: StoreService;
  let inventoryService: InventoryService;
  let catalogService: CatalogService;
  let listingsService: ListingsService;

  beforeEach(() => {
    store = new StoreService();
    store.seedInitialData();
    inventoryService = new InventoryService(store);
    catalogService = new CatalogService(store);
    listingsService = new ListingsService(store);
  });

  it('BR-01 & BR-04: Bắt buộc biên lợi nhuận tối thiểu (salePrice >= costPrice * 1.1)', async () => {
    const product = store.products[0]; // costPrice: 180000 -> min salePrice: 198000
    const shop = store.shops[0];
    const seller = store.sellerProfiles[0];

    // Tạo listing dưới margin (185.000 đ < 198.000 đ) -> phải ném lỗi
    await expect(
      listingsService.createListing(seller.id, {
        shopId: shop.id,
        productId: product.id,
        salePrice: 185000,
      }),
    ).rejects.toThrow('SALE_PRICE_BELOW_MIN_MARGIN');

    // Tạo listing hợp lệ trên margin (210.000 đ) -> thành công và ACTIVE
    const validListing = await listingsService.createListing(seller.id, {
      shopId: shop.id,
      productId: product.id,
      salePrice: 210000,
    });
    expect(validListing.status).toBe('ACTIVE');
    expect(validListing.salePrice).toBe(210000);
  });

  it('WF-01 & BR 7.11: Khi NCC tăng giá vốn làm vi phạm margin, listing tự động chuyển sang PAUSED_PRICE_MISMATCH', async () => {
    const product = store.products[0]; // cost: 180000, listing L1 salePrice: 279000
    const listing = store.listings.find(l => l.productId === product.id)!;
    expect(listing.status).toBe('ACTIVE');

    // Supplier tăng costPrice lên 260000 (260000 * 1.1 = 286000 > 279000)
    await catalogService.updateProduct(product.supplierId, product.id, { costPrice: 260000 });

    expect(listing.status).toBe('PAUSED_PRICE_MISMATCH');
    expect(listing.visible).toBe(false);
  });

  it('BR-03 & Atomic Inventory: Tạm giữ tồn kho (holdStock) thành công khi khả dụng đủ, từ chối khi vượt tồn', async () => {
    const product = store.products[0];
    const initialStock = product.availableStock; // e.g. 50

    // Hold 5 sản phẩm
    const reservation = await inventoryService.holdStock(product.id, 5, 'order-item-test-1');
    expect(reservation.status).toBe('HELD');
    expect(reservation.quantity).toBe(5);

    // Kiểm tra số lượng tồn khả dụng còn lại
    const stockInfo = await inventoryService.getProductStock(product.id);
    expect(stockInfo.heldQuantity).toBe(5);
    expect(stockInfo.availableForSale).toBe(initialStock - 5);

    // Yêu cầu hold vượt quá số lượng còn lại -> ném lỗi INSUFFICIENT_STOCK
    await expect(
      inventoryService.holdStock(product.id, initialStock, 'order-item-test-2'),
    ).rejects.toThrow('INSUFFICIENT_STOCK');
  });

  it('BR-03 & Atomic Inventory: Commit trừ kho thật và Release hoàn trả tồn kho', async () => {
    const product = store.products[0];
    const initialStock = product.availableStock;

    // 1. Hold 3 sản phẩm
    const res = await inventoryService.holdStock(product.id, 3, 'order-item-commit');
    expect(res.status).toBe('HELD');

    // 2. Commit stock khi NCC duyệt đơn -> trừ tồn kho gốc
    await inventoryService.commitStock(res.id);
    const updatedRes = store.stockReservations.find(r => r.id === res.id)!;
    expect(updatedRes.status).toBe('COMMITTED');

    const productAfterCommit = store.products.find(p => p.id === product.id)!;
    expect(productAfterCommit.availableStock).toBe(initialStock - 3);

    // 3. Test release: Hold 2 sản phẩm và Release khi hủy đơn
    const res2 = await inventoryService.holdStock(product.id, 2, 'order-item-release');
    await inventoryService.releaseStock(res2.id);
    const updatedRes2 = store.stockReservations.find(r => r.id === res2.id)!;
    expect(updatedRes2.status).toBe('RELEASED');
  });
});
