import type {
  AllocationDraft,
  CheckoutCart,
  CheckoutQuoteBatch,
  CustomerOrder,
  DomainEventEnvelope,
  FulfillmentDraftGroup,
  OrderAggregate,
  OutboxEvent,
  PaymentMethod,
} from "../domain/order";
import type { CheckoutRequest, CheckoutResponse } from "../api/contracts";

export const ORDERS_CART_READER = Symbol("ORDERS_CART_READER");
export const ORDERS_LISTINGS_QUOTE = Symbol("ORDERS_LISTINGS_QUOTE");
export const ORDERS_INVENTORY = Symbol("ORDERS_INVENTORY");
export const ORDERS_CURRENT_ACTOR = Symbol("ORDERS_CURRENT_ACTOR");
export const ORDERS_IDEMPOTENCY = Symbol("ORDERS_IDEMPOTENCY");
export const ORDERS_CHECKOUT_EXECUTOR = Symbol("ORDERS_CHECKOUT_EXECUTOR");
export const ORDERS_TRANSACTION = Symbol("ORDERS_TRANSACTION");
export const ORDERS_PAYMENTS = Symbol("ORDERS_PAYMENTS");
export const ORDERS_FULFILLMENT = Symbol("ORDERS_FULFILLMENT");
export const ORDERS_OUTBOX = Symbol("ORDERS_OUTBOX");
export const ORDERS_ORDER_REPOSITORY = Symbol("ORDERS_ORDER_REPOSITORY");
export const ORDERS_PROCESSED_EVENTS = Symbol("ORDERS_PROCESSED_EVENTS");
export const ORDERS_EVENT_CONSUMER = Symbol("ORDERS_EVENT_CONSUMER");

export interface CurrentActor {
  readonly userId: string;
  readonly activeRole: string;
  readonly activeProfileId: string | null;
}

export interface CurrentActorPort {
  getCurrentActor(): Promise<CurrentActor | null>;
}

/** Consumer-side shape. The Cart owner supplies the adapter in integration. */
export interface CartReaderPort {
  getForCheckout(customerId: string): Promise<CheckoutCart | null>;
}

/** Opaque until Common publishes its concrete transaction adapter. */
export interface CheckoutTransactionContext {
  readonly token: unknown;
}

export interface TransactionPort {
  runInTransaction<T>(
    callback: (context: CheckoutTransactionContext) => Promise<T>,
  ): Promise<T>;
}

/**
 * Listings verifies Listing/Product ACTIVE, Supplier/Seller APPROVED, Shop
 * ACTIVE and margin. Every requested listingId is expected either in `quotes`
 * or in `rejections`; Orders treats a silent omission as LISTING_UNAVAILABLE.
 */
export interface ListingsQuotePort {
  getCheckoutQuotes(
    listingIds: readonly string[],
    context: CheckoutTransactionContext,
  ): Promise<CheckoutQuoteBatch>;
}

export interface StockHold {
  readonly reservationId: string;
  readonly orderItemId: string;
  readonly quantity: number;
  readonly status: "HELD";
  readonly expiresAt: string;
}

export interface InventoryPort {
  getAvailability(productId: string): Promise<number>;
  holdStock(
    context: CheckoutTransactionContext,
    orderItemId: string,
    productId: string,
    quantity: number,
    expiresAt: string,
  ): Promise<StockHold>;
}

export interface FulfillmentPort {
  createInitialInCheckout(
    context: CheckoutTransactionContext,
    groups: readonly FulfillmentDraftGroup[],
  ): Promise<void>;
}

export interface CheckoutObligation {
  readonly paymentId: string;
  readonly paymentIntentId: string;
  readonly status: "PENDING_COD" | "PENDING";
  readonly allocationIds: readonly string[];
}

export interface PaymentsPort {
  createCheckoutObligation(
    context: CheckoutTransactionContext,
    orderId: string,
    method: PaymentMethod,
    allocations: readonly AllocationDraft[],
  ): Promise<CheckoutObligation>;
}

export interface OutboxPort {
  add(context: CheckoutTransactionContext, event: OutboxEvent): Promise<void>;
}

export interface IdempotencyRecord {
  readonly customerId: string;
  readonly key: string;
  readonly requestHash: string;
  readonly response: CheckoutResponse;
}

export interface IdempotencyPort {
  find(customerId: string, key: string): Promise<IdempotencyRecord | null>;
  save(
    context: CheckoutTransactionContext,
    record: IdempotencyRecord,
  ): Promise<void>;
}

export interface CheckoutExecutionContext {
  readonly customerId: string;
  readonly key: string;
  readonly requestHash: string;
  readonly request: CheckoutRequest;
}

export interface CheckoutExecutorPort {
  execute(context: CheckoutExecutionContext): Promise<CheckoutResponse>;
}

export interface OrderRepositoryPort {
  save(
    context: CheckoutTransactionContext,
    aggregate: OrderAggregate,
  ): Promise<void>;
  findById(orderId: string): Promise<OrderAggregate | null>;
}

export interface ProcessedEventRecord {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly processedAt: string;
  readonly sourceRef?: string;
  readonly reasonCode?: string;
}

export interface ProcessedEventPort {
  isProcessed(eventId: string): Promise<boolean>;
  record(
    context: CheckoutTransactionContext,
    record: ProcessedEventRecord,
  ): Promise<void>;
}

export interface EventProcessingResult {
  readonly status: "PROCESSED" | "IGNORED_DUPLICATE" | "ORDER_NOT_FOUND";
  readonly order?: CustomerOrder;
  readonly reason?: string;
}

export interface OrderEventConsumerPort {
  consume(
    event: DomainEventEnvelope<Record<string, unknown>>,
  ): Promise<EventProcessingResult>;
}


