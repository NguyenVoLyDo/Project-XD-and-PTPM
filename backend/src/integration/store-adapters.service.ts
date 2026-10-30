import { Injectable, Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { StoreService } from "../common/database/store.service";
import { InventoryService } from "../modules/inventory/inventory.service";
import type {
  CartListingProjectionPort,
  CartStorePort,
  CurrentActorPort as CartActorPort,
  ListingProjection,
} from "../modules/cart/application/ports";
import type { CartSnapshot } from "../modules/cart/domain/cart";
import type {
  CartReaderPort,
  CheckoutObligation,
  CheckoutTransactionContext,
  CurrentActor,
  CurrentActorPort as OrdersActorPort,
  FulfillmentPort,
  IdempotencyPort,
  IdempotencyRecord,
  InventoryPort,
  ListingsQuotePort,
  OrderRepositoryPort,
  OutboxPort,
  PaginatedResult,
  PaginationQuery,
  PaymentsPort,
  ProcessedEventPort,
  ProcessedEventRecord,
  StockHold,
  TransactionPort,
} from "../modules/orders/application/ports";
import type {
  AllocationDraft,
  CheckoutCart,
  CheckoutQuote,
  CheckoutQuoteBatch,
  FulfillmentDraftGroup,
  ListingQuoteRejection,
  OrderAggregate,
  OutboxEvent,
  PaymentMethod,
} from "../modules/orders/domain/order";

@Injectable({ scope: Scope.REQUEST })
export class RequestActorAdapter implements CartActorPort, OrdersActorPort {
  constructor(@Inject(REQUEST) private readonly request: any) {}

  async getCurrentActor(): Promise<CurrentActor | null> {
    const user = this.request.user;
    if (!user) return null;
    return {
      userId: user.userId,
      activeRole: user.role,
      activeProfileId: user.role === "CUSTOMER" ? null
        : user.role === "SELLER" ? user.sellerProfileId ?? null
        : user.supplierProfileId ?? null,
    };
  }
}

/** Local demo state only; this is not a PostgreSQL transaction adapter. */
@Injectable()
export class DemoCheckoutState {
  orders = new Map<string, OrderAggregate>();
  idempotency = new Map<string, IdempotencyRecord>();
  processedEvents = new Set<string>();
  outbox: OutboxEvent[] = [];
  queue: Promise<void> = Promise.resolve();
}

@Injectable()
export class CartIntegrationAdapter
  implements CartStorePort, CartListingProjectionPort, CartReaderPort
{
  private readonly cartsByCustomer = new Map<string, CartSnapshot>();

  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  async getByCustomerId(customerId: string): Promise<CartSnapshot | null> {
    return structuredClone(this.cartsByCustomer.get(customerId) ?? null);
  }

  async save(cart: CartSnapshot): Promise<void> {
    this.cartsByCustomer.set(cart.customerId, structuredClone(cart));
  }

  async getForCart(listingIds: readonly string[]): Promise<readonly ListingProjection[]> {
    const result: ListingProjection[] = [];

    for (const id of listingIds) {
      const listing = this.store.listings.find((l) => l.id === id);
      if (!listing) continue;

      const product = this.store.products.find((p) => p.id === listing.productId);
      const heldStock = this.store.stockReservations
        .filter((r) => r.productId === listing.productId && r.status === "HELD" && new Date(r.expiresAt) > new Date())
        .reduce((sum, r) => sum + r.quantity, 0);
      const effectiveStock = Math.max(0, (product?.availableStock || 0) - heldStock);

      let availability: "AVAILABLE" | "UNAVAILABLE" = "AVAILABLE";
      let unavailableCode: "LISTING_UNAVAILABLE" | "LISTING_PAUSED_BY_POLICY" | undefined;

      if (listing.status === "PAUSED_PRICE_MISMATCH") {
        availability = "UNAVAILABLE";
        unavailableCode = "LISTING_PAUSED_BY_POLICY";
      } else if (listing.status !== "ACTIVE" || !listing.visible || effectiveStock <= 0) {
        availability = "UNAVAILABLE";
        unavailableCode = "LISTING_UNAVAILABLE";
      }

      result.push({
        listingId: listing.id,
        title: product?.name || "Sản phẩm",
        unitSalePrice: listing.salePrice,
        currency: "VND",
        availability,
        unavailableCode,
      });
    }

    return result;
  }

  async getForCheckout(customerId: string): Promise<CheckoutCart | null> {
    const snapshot = this.cartsByCustomer.get(customerId);
    if (!snapshot) return null;

    return {
      cartId: snapshot.cartId,
      items: snapshot.items.map((item) => ({
        listingId: item.listingId,
        quantity: item.quantity,
        lastViewedUnitSalePrice: item.lastViewedUnitSalePrice,
      })),
    };
  }
}

@Injectable()
export class OrdersCatalogInventoryAdapter
  implements ListingsQuotePort, InventoryPort, TransactionPort
{
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(DemoCheckoutState) private readonly state: DemoCheckoutState,
  ) {}

  async runInTransaction<T>(
    callback: (context: CheckoutTransactionContext) => Promise<T>,
  ): Promise<T> {
    // Serialize demo checkout/event writes and restore every checkout-owned store on failure.
    const previous = this.state.queue;
    let release!: () => void;
    this.state.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const fields = ["stockReservations", "customerOrders", "orderItems", "fulfillmentOrders",
      "fulfillmentItems", "payments", "paymentAllocations"] as const;
    const snapshot = fields.map((field) => structuredClone(this.store[field]));
    const stateSnapshot = structuredClone({ orders: this.state.orders, idempotency: this.state.idempotency,
      processedEvents: this.state.processedEvents, outbox: this.state.outbox });
    try {
      return await callback({ token: Symbol("demo-checkout-transaction") });
    } catch (error) {
      fields.forEach((field, index) => {
        (this.store[field] as unknown[]) = snapshot[index];
      });
      Object.assign(this.state, stateSnapshot);
      throw error;
    } finally {
      release();
    }
  }

  async getCheckoutQuotes(
    listingIds: readonly string[],
    _context: CheckoutTransactionContext,
  ): Promise<CheckoutQuoteBatch> {
    const quotes: CheckoutQuote[] = [];
    const rejections: ListingQuoteRejection[] = [];

    for (const listingId of listingIds) {
      const listing = this.store.listings.find((l) => l.id === listingId);
      if (!listing) {
        rejections.push({ listingId, code: "LISTING_NOT_FOUND" });
        continue;
      }

      const product = this.store.products.find((p) => p.id === listing.productId);
      const shop = this.store.shops.find((s) => s.id === listing.shopId);
      const seller = this.store.sellerProfiles.find((s) => s.id === shop?.sellerId);

      const supplier = this.store.supplierProfiles.find((s) => s.id === product?.supplierId);
      if (listing.status === "PAUSED_PRICE_MISMATCH" || (product && listing.salePrice < Math.ceil(product.costPrice * 1.1))) {
        rejections.push({ listingId, code: "LISTING_PAUSED_BY_POLICY" });
        continue;
      }

      if (listing.status !== "ACTIVE" || !listing.visible || !product || product.status !== "ACTIVE"
        || shop?.status !== "ACTIVE" || seller?.approvalStatus !== "APPROVED" || supplier?.approvalStatus !== "APPROVED") {
        rejections.push({ listingId, code: "LISTING_UNAVAILABLE" });
        continue;
      }

      quotes.push({
        listingId: listing.id,
        productId: listing.productId,
        supplierId: product.supplierId,
        sellerId: seller!.id,
        productName: product.name,
        listingTitle: product.name,
        unitCostPrice: product.costPrice,
        unitSalePrice: listing.salePrice,
        currency: "VND",
        status: "ACTIVE",
      });
    }

    return { quotes, rejections };
  }

  async getAvailability(productId: string): Promise<number> {
    const res = await this.inventoryService.getProductStock(productId);
    return res.availableForSale;
  }

  async holdStock(
    _context: CheckoutTransactionContext,
    orderItemId: string,
    productId: string,
    quantity: number,
    expiresAt: string,
  ): Promise<StockHold> {
    const ttlMinutes = (Date.parse(expiresAt) - Date.now()) / 60_000;
    const reservation = await this.inventoryService.holdStock(productId, quantity, orderItemId, ttlMinutes);
    reservation.expiresAt = expiresAt;
    return {
      reservationId: reservation.id,
      orderItemId,
      quantity,
      status: "HELD",
      expiresAt: reservation.expiresAt,
    };
  }
}

@Injectable()
export class OrdersIdempotencyAdapter implements IdempotencyPort {
  constructor(@Inject(DemoCheckoutState) private readonly state: DemoCheckoutState) {}

  async find(customerId: string, key: string): Promise<IdempotencyRecord | null> {
    const compositeKey = `${customerId}:${key}`;
    return structuredClone(this.state.idempotency.get(compositeKey) ?? null);
  }

  async save(
    _context: CheckoutTransactionContext,
    record: IdempotencyRecord,
  ): Promise<void> {
    const compositeKey = `${record.customerId}:${record.key}`;
    this.state.idempotency.set(compositeKey, structuredClone(record));
  }
}

@Injectable()
export class OrdersRepositoryAdapter implements OrderRepositoryPort {
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(DemoCheckoutState) private readonly state: DemoCheckoutState,
  ) {}

  async save(
    _context: CheckoutTransactionContext,
    aggregate: OrderAggregate,
  ): Promise<void> {
    this.state.orders.set(aggregate.order.orderId, structuredClone(aggregate));
    for (const item of aggregate.items) {
      const row = {
        id: item.orderItemId, customerOrderId: item.customerOrderId, listingId: item.listingId,
        productNameSnapshot: item.productName, quantity: item.quantity,
        unitSalePriceSnapshot: item.unitSalePrice, unitCostPriceSnapshot: item.unitCostPrice,
        createdAt: aggregate.order.createdAt,
      };
      const index = this.store.orderItems.findIndex((stored) => stored.id === row.id);
      if (index < 0) this.store.orderItems.push(row);
      else this.store.orderItems[index] = row;
      const fulfillmentItem = this.store.fulfillmentItems.find((stored) => stored.orderItemId === item.orderItemId);
      if (!fulfillmentItem) this.store.fulfillmentItems.push({
        id: randomUUID(), fulfillmentOrderId: item.fulfillmentOrderId, orderItemId: item.orderItemId,
        quantity: item.quantity, itemGrossSnapshot: item.lineSaleTotal,
      });
    }

    const storeOrder = {
      id: aggregate.order.orderId,
      orderNo: aggregate.order.orderNo,
      customerId: aggregate.order.customerId,
      status: aggregate.order.status as any,
      fulfillmentSummary: aggregate.order.fulfillmentSummary as any,
      currency: "VND",
      grandTotal: aggregate.order.grandTotal,
      totalPayable: aggregate.order.totalPayable,
      shippingAddress: {
        recipientName: aggregate.order.shippingAddress.recipientName,
        phone: aggregate.order.shippingAddress.phone,
        address: aggregate.order.shippingAddress.line1,
        city: aggregate.order.shippingAddress.provinceCode,
      },
      placedAt: aggregate.order.createdAt,
      createdAt: aggregate.order.createdAt,
      updatedAt: aggregate.order.updatedAt,
    };

    const existingIdx = this.store.customerOrders.findIndex((o) => o.id === aggregate.order.orderId);
    if (existingIdx >= 0) {
      this.store.customerOrders[existingIdx] = storeOrder;
    } else {
      this.store.customerOrders.unshift(storeOrder);
    }
  }

  async findById(orderId: string): Promise<OrderAggregate | null> {
    return structuredClone(this.state.orders.get(orderId) ?? null);
  }

  async findByCustomerId(
    customerId: string,
    pagination?: PaginationQuery,
  ): Promise<PaginatedResult<OrderAggregate>> {
    const list = Array.from(this.state.orders.values())
      .filter((agg) => agg.order.customerId === customerId)
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());

    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const start = (page - 1) * limit;
    const items = structuredClone(list.slice(start, start + limit));

    return {
      items,
      total: list.length,
      page,
      limit,
      totalPages: Math.ceil(list.length / limit) || 1,
    };
  }
}

@Injectable()
export class OrdersExecutionAdapter
  implements
    FulfillmentPort,
    PaymentsPort,
    OutboxPort,
    ProcessedEventPort
{
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(DemoCheckoutState) private readonly state: DemoCheckoutState,
  ) {}

  async createInitialInCheckout(
    _context: CheckoutTransactionContext,
    groups: readonly FulfillmentDraftGroup[],
  ): Promise<void> {
    for (const group of groups) {
      const fulfillmentOrderId = group.fulfillmentOrderId || randomUUID();
      this.store.fulfillmentOrders.push({
        id: fulfillmentOrderId,
        fulfillmentNo: `FF-${Date.now().toString().slice(-6)}`,
        customerOrderId: group.customerOrderId,
        supplierId: group.supplierId,
        sellerId: group.sellerId,
        status: "PENDING_ACCEPTANCE",
        trackingNo: null,
        carrierCode: "VNPOST",
        currency: "VND",
        deliveryAttemptCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });


    }
  }

  async createCheckoutObligation(
    _context: CheckoutTransactionContext,
    orderId: string,
    paymentMethod: PaymentMethod,
    allocations: readonly AllocationDraft[],
  ): Promise<CheckoutObligation> {
    const paymentId = randomUUID();
    const paymentIntentId = `pi_${randomUUID().slice(0, 12)}`;

    for (const alloc of allocations) {
      this.store.paymentAllocations.push({
        id: alloc.fulfillmentOrderId,
        paymentId,
        fulfillmentOrderId: alloc.fulfillmentOrderId,
        merchandiseAmount: alloc.merchandiseAmount,
        shippingAmount: alloc.shippingAmount,
        discountAmount: alloc.discountAmount,
        amountToCollect: alloc.amountToCollect,
        currency: "VND",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      });
    }

    this.store.payments.push({
      id: paymentId,
      customerOrderId: orderId,
      paymentIntentId,
      method: paymentMethod === "ONLINE" ? "ONLINE_MOCK" : "COD",
      status: paymentMethod === "COD" ? "PENDING_COD" : "PENDING",
      amount: allocations.reduce((sum, a) => sum + a.amountToCollect, 0),
      providerTransactionRef: `TXN-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      paymentId,
      paymentIntentId,
      status: paymentMethod === "COD" ? "PENDING_COD" : "PENDING",
      allocationIds: allocations.map((a) => a.fulfillmentOrderId),
    };
  }

  async add(
    _context: CheckoutTransactionContext,
    event: OutboxEvent,
  ): Promise<void> {
    this.state.outbox.push(structuredClone(event));
  }

  async isProcessed(eventId: string): Promise<boolean> {
    return this.state.processedEvents.has(eventId);
  }

  async record(
    _context: CheckoutTransactionContext,
    record: ProcessedEventRecord,
  ): Promise<void> {
    this.state.processedEvents.add(record.eventId);
  }
}
