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
  OutboxPort,
  PaymentsPort,
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

export class MockTransaction implements TransactionPort {
  readonly context: CheckoutTransactionContext = {
    token: Symbol("mock-checkout-transaction"),
  };
  calls = 0;
  async runInTransaction<T>(
    callback: (context: CheckoutTransactionContext) => Promise<T>,
  ): Promise<T> {
    this.calls += 1;
    return callback(this.context);
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
    _context: CheckoutTransactionContext,
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
  async createInitialInCheckout(
    _context: CheckoutTransactionContext,
    groups: readonly FulfillmentDraftGroup[],
  ): Promise<void> {
    this.groups.push(...groups);
  }
}

export class MockPayments implements PaymentsPort {
  readonly calls: {
    orderId: string;
    method: PaymentMethod;
    allocations: readonly AllocationDraft[];
  }[] = [];
  constructor(
    private readonly obligations: Partial<
      Record<PaymentMethod, CheckoutObligation>
    >,
  ) {}
  async createCheckoutObligation(
    _context: CheckoutTransactionContext,
    orderId: string,
    method: PaymentMethod,
    allocations: readonly AllocationDraft[],
  ): Promise<CheckoutObligation> {
    this.calls.push({ orderId, method, allocations });
    const obligation = this.obligations[method];
    if (!obligation) throw new Error(`No mock obligation for ${method}`);
    return obligation;
  }
}

export class MockOutbox implements OutboxPort {
  readonly events: OutboxEvent[] = [];
  async add(
    _context: CheckoutTransactionContext,
    event: OutboxEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

export class MockIdempotencyStore implements IdempotencyPort {
  private readonly records = new Map<string, IdempotencyRecord>();
  async find(
    customerId: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    return this.records.get(`${customerId}\u0000${key}`) ?? null;
  }
  async save(
    _context: CheckoutTransactionContext,
    record: IdempotencyRecord,
  ): Promise<void> {
    this.records.set(`${record.customerId}\u0000${record.key}`, record);
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

