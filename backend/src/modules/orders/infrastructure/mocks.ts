import { randomUUID } from "node:crypto";
import type {
  CartReaderPort,
  CheckoutExecutionContext,
  CheckoutExecutorPort,
  CheckoutObligation,
  CheckoutTransactionContext,
  CurrentActor,
  CurrentActorPort,
  FulfillmentPort,
  IdempotencyPort,
  IdempotencyRecord,
  InventoryPort,
  ListingsQuotePort,
  OrderRepositoryPort,
  OutboxPort,
  PaymentsPort,
  ProcessedEventPort,
  ProcessedEventRecord,
  StockHold,
  TransactionPort,
} from "../application/ports";
import type { CheckoutResponse } from "../api/contracts";
import type {
  AllocationDraft,
  CheckoutCart,
  CheckoutQuote,
  CheckoutQuoteBatch,
  FulfillmentDraftGroup,
  ListingQuoteRejection,
  ListingRejectionCode,
  OrderAggregate,
  OutboxEvent,
  PaymentMethod,
} from "../domain/order";

export class MockCurrentActor implements CurrentActorPort {
  constructor(public actor: CurrentActor | null) {}
  async getCurrentActor(): Promise<CurrentActor | null> {
    return this.actor;
  }
}

export class MockCartReader implements CartReaderPort {
  constructor(private readonly carts: ReadonlyMap<string, CheckoutCart>) {}
  async getForCheckout(customerId: string): Promise<CheckoutCart | null> {
    return this.carts.get(customerId) ?? null;
  }
}

export interface MockTransactionContext extends CheckoutTransactionContext {
  registerRollback(action: () => void): void;
}

export class MockTransaction implements TransactionPort {
  private readonly rollbacks: Array<() => void> = [];
  readonly context: MockTransactionContext = {
    token: Symbol("mock-checkout-transaction"),
    registerRollback: (action: () => void) => {
      this.rollbacks.push(action);
    },
  };
  calls = 0;

  async runInTransaction<T>(
    callback: (context: CheckoutTransactionContext) => Promise<T>,
  ): Promise<T> {
    this.calls += 1;
    const initialCount = this.rollbacks.length;

    try {
      return await callback(this.context);
    } catch (error) {
      const pending = this.rollbacks.splice(initialCount);
      for (const action of pending.reverse()) {
        try {
          action();
        } catch {
          // ignore rollback error
        }
      }
      throw error;
    }
  }
}


export class MockListingsQuote implements ListingsQuotePort {
  private readonly quotes: Map<string, CheckoutQuote>;
  private readonly rejections: Map<string, ListingRejectionCode>;
  readonly contexts: CheckoutTransactionContext[] = [];

  constructor(
    quotes: readonly CheckoutQuote[],
    rejections: readonly ListingQuoteRejection[] = [],
  ) {
    this.quotes = new Map(quotes.map((quote) => [quote.listingId, quote]));
    this.rejections = new Map(
      rejections.map((rejection) => [rejection.listingId, rejection.code]),
    );
  }

  /** Simulates a Seller price change after the Customer viewed the Cart. */
  setSalePrice(listingId: string, unitSalePrice: number): void {
    const quote = this.quotes.get(listingId);
    if (!quote) throw new Error(`No mock quote for ${listingId}`);
    this.quotes.set(listingId, { ...quote, unitSalePrice });
  }

  reject(listingId: string, code: ListingRejectionCode): void {
    this.rejections.set(listingId, code);
  }

  async getCheckoutQuotes(
    listingIds: readonly string[],
    context: CheckoutTransactionContext,
  ): Promise<CheckoutQuoteBatch> {
    this.contexts.push(context);
    const quotes: CheckoutQuote[] = [];
    const rejections: ListingQuoteRejection[] = [];
    for (const listingId of listingIds) {
      const rejected = this.rejections.get(listingId);
      const quote = this.quotes.get(listingId);
      if (rejected) rejections.push({ listingId, code: rejected });
      else if (quote) quotes.push(quote);
      else rejections.push({ listingId, code: "LISTING_NOT_FOUND" });
    }
    return { quotes, rejections };
  }
}

export class MockInventory implements InventoryPort {
  readonly holds: StockHold[] = [];
  private readonly available: Map<string, number>;
  private readonly heldByItem = new Map<string, StockHold>();

  constructor(available: ReadonlyMap<string, number>) {
    this.available = new Map(available);
  }

  async getAvailability(productId: string): Promise<number> {
    return this.available.get(productId) ?? 0;
  }

  async holdStock(
    context: CheckoutTransactionContext,
    orderItemId: string,
    productId: string,
    quantity: number,
    expiresAt: string,
  ): Promise<StockHold> {
    const previous = this.heldByItem.get(orderItemId);
    if (previous) return previous;
    const remaining = this.available.get(productId) ?? 0;
    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      remaining < quantity
    ) {
      throw new MockPortError("INSUFFICIENT_STOCK", 409);
    }
    const hold: StockHold = {
      reservationId: randomUUID(),
      orderItemId,
      quantity,
      status: "HELD",
      expiresAt,
    };
    this.available.set(productId, remaining - quantity);
    this.heldByItem.set(orderItemId, hold);
    this.holds.push(hold);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      this.available.set(productId, remaining);
      this.heldByItem.delete(orderItemId);
      const idx = this.holds.indexOf(hold);
      if (idx >= 0) this.holds.splice(idx, 1);
    });

    return hold;
  }
}

export class MockPortError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export class MockFulfillment implements FulfillmentPort {
  readonly groups: FulfillmentDraftGroup[] = [];
  failNext = false;

  async createInitialInCheckout(
    context: CheckoutTransactionContext,
    groups: readonly FulfillmentDraftGroup[],
  ): Promise<void> {
    if (this.failNext) {
      throw new MockPortError("FULFILLMENT_UNAVAILABLE", 500);
    }
    const startIdx = this.groups.length;
    this.groups.push(...groups);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      this.groups.splice(startIdx, groups.length);
    });
  }
}

export class MockPayments implements PaymentsPort {
  readonly calls: {
    orderId: string;
    method: PaymentMethod;
    allocations: readonly AllocationDraft[];
  }[] = [];
  failNext = false;

  constructor(
    private readonly obligations: Partial<
      Record<PaymentMethod, CheckoutObligation>
    >,
  ) {}

  async createCheckoutObligation(
    context: CheckoutTransactionContext,
    orderId: string,
    method: PaymentMethod,
    allocations: readonly AllocationDraft[],
  ): Promise<CheckoutObligation> {
    if (this.failNext) {
      throw new MockPortError("PAYMENT_SERVICE_UNAVAILABLE", 500);
    }
    const call = { orderId, method, allocations };
    this.calls.push(call);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      const idx = this.calls.indexOf(call);
      if (idx >= 0) this.calls.splice(idx, 1);
    });

    const obligation = this.obligations[method];
    if (!obligation) throw new Error(`No mock obligation for ${method}`);

    // If obligation has fewer allocationIds than allocations, supply unique IDs
    const allocationIds = allocations.map(
      (_, i) => obligation.allocationIds[i] ?? randomUUID(),
    );
    return { ...obligation, allocationIds };
  }
}

export class MockOutbox implements OutboxPort {
  readonly events: OutboxEvent[] = [];
  failNext = false;

  async add(
    context: CheckoutTransactionContext,
    event: OutboxEvent,
  ): Promise<void> {
    if (this.failNext) {
      throw new MockPortError("OUTBOX_ERROR", 500);
    }
    this.events.push(event);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      const idx = this.events.indexOf(event);
      if (idx >= 0) this.events.splice(idx, 1);
    });
  }
}

export class MockIdempotencyStore implements IdempotencyPort {
  private readonly records = new Map<string, IdempotencyRecord>();
  failNext = false;

  async find(
    customerId: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    return this.records.get(`${customerId}\u0000${key}`) ?? null;
  }

  async save(
    context: CheckoutTransactionContext,
    record: IdempotencyRecord,
  ): Promise<void> {
    if (this.failNext) {
      throw new MockPortError("IDEMPOTENCY_STORE_ERROR", 500);
    }
    const key = `${record.customerId}\u0000${record.key}`;
    const previous = this.records.get(key);
    this.records.set(key, record);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      if (previous) this.records.set(key, previous);
      else this.records.delete(key);
    });
  }
}

export class MockOrderRepository implements OrderRepositoryPort {
  readonly orders = new Map<string, OrderAggregate>();
  failNext = false;

  async save(
    context: CheckoutTransactionContext,
    aggregate: OrderAggregate,
  ): Promise<void> {
    if (this.failNext) {
      throw new MockPortError("ORDER_REPOSITORY_ERROR", 500);
    }
    const orderId = aggregate.order.orderId;
    const previous = this.orders.get(orderId);
    this.orders.set(orderId, aggregate);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      if (previous) this.orders.set(orderId, previous);
      else this.orders.delete(orderId);
    });
  }

  async findById(orderId: string): Promise<OrderAggregate | null> {
    return this.orders.get(orderId) ?? null;
  }
}

export class MockCheckoutExecutor implements CheckoutExecutorPort {
  readonly calls: CheckoutExecutionContext[] = [];

  constructor(
    private readonly responseFactory: (
      context: CheckoutExecutionContext,
    ) => Promise<CheckoutResponse> | CheckoutResponse,
    private readonly idempotencyStore: IdempotencyPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(context: CheckoutExecutionContext): Promise<CheckoutResponse> {
    this.calls.push(context);
    const response = await this.responseFactory(context);
    await this.transaction.runInTransaction(async (txContext) => {
      await this.idempotencyStore.save(txContext, {
        customerId: context.customerId,
        key: context.key,
        requestHash: context.requestHash,
        response,
      });
    });
    return response;
  }
}

export class MockProcessedEvents implements ProcessedEventPort {
  readonly processed = new Map<string, ProcessedEventRecord>();
  failNext = false;

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async record(
    context: CheckoutTransactionContext,
    record: ProcessedEventRecord,
  ): Promise<void> {
    if (this.failNext) {
      throw new MockPortError("PROCESSED_EVENTS_STORE_ERROR", 500);
    }
    const previous = this.processed.get(record.eventId);
    this.processed.set(record.eventId, record);

    const mockCtx = context as Partial<MockTransactionContext>;
    mockCtx.registerRollback?.(() => {
      if (previous) this.processed.set(record.eventId, previous);
      else this.processed.delete(record.eventId);
    });
  }
}
