import type {
  AllocationDraft,
  CheckoutCart,
  CheckoutQuote,
  FulfillmentDraftGroup,
  OutboxEvent,
  PaymentMethod,
} from "../domain/order";
import type { CheckoutResponse } from "../api/contracts";

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

export interface ListingsQuotePort {
  getCheckoutQuotes(
    listingIds: readonly string[],
    context: CheckoutTransactionContext,
  ): Promise<readonly CheckoutQuote[]>;
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
