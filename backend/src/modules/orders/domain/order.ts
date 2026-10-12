export type PaymentMethod = "COD" | "ONLINE";

export interface CheckoutCartItem {
  readonly listingId: string;
  readonly quantity: number;
  /**
   * Internal Cart baseline (price last shown in a CartView). Used only to
   * detect PRICE_CHANGED; never used as the checkout price.
   */
  readonly lastViewedUnitSalePrice?: number;
}

export interface CheckoutCart {
  readonly cartId: string;
  readonly items: readonly CheckoutCartItem[];
}

export interface CheckoutQuote {
  readonly listingId: string;
  readonly productId: string;
  readonly supplierId: string;
  readonly sellerId: string;
  readonly productName: string;
  readonly listingTitle: string;
  readonly unitSalePrice: number;
  readonly unitCostPrice: number;
  readonly currency: "VND";
  readonly status: "ACTIVE";
}

/** Item-level refusal reported by Listings (contracts/listings.md). */
export type ListingRejectionCode =
  | "LISTING_NOT_FOUND"
  | "LISTING_UNAVAILABLE"
  | "LISTING_PAUSED_BY_POLICY";

export interface ListingQuoteRejection {
  readonly listingId: string;
  readonly code: ListingRejectionCode;
}

/** Result of `getCheckoutQuotes`: valid quotes plus item-level rejections. */
export interface CheckoutQuoteBatch {
  readonly quotes: readonly CheckoutQuote[];
  readonly rejections: readonly ListingQuoteRejection[];
}

/** One server-verified cart line. Prices come from the quote, never the Cart. */
export interface QuotedCheckoutLine {
  /** Position of the item in the cart; matches `items[n]` in error details. */
  readonly lineIndex: number;
  readonly listingId: string;
  readonly productId: string;
  readonly supplierId: string;
  readonly sellerId: string;
  readonly productName: string;
  readonly listingTitle: string;
  readonly quantity: number;
  readonly unitSalePrice: number;
  readonly unitCostPrice: number;
  readonly lineSaleTotal: number;
  readonly lineCostTotal: number;
  readonly currency: "VND";
}

/** Workflow 3 output; the only input Workflow 5 may snapshot and split. */
export interface CheckoutQuotation {
  readonly customerId: string;
  readonly cartId: string;
  readonly lines: readonly QuotedCheckoutLine[];
  readonly merchandiseTotal: number;
  readonly currency: "VND";
}

export interface ShippingAddressSnapshot {
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly wardCode: string;
  readonly provinceCode: string;
}

export interface AllocationDraft {
  readonly fulfillmentOrderId: string;
  readonly merchandiseAmount: number;
  readonly shippingAmount: number;
  readonly discountAmount: number;
  readonly amountToCollect: number;
  readonly currency: "VND";
}

export interface FulfillmentDraftGroup {
  readonly fulfillmentOrderId: string;
  readonly customerOrderId: string;
  readonly supplierId: string;
  readonly sellerId: string;
  readonly orderItemIds: readonly string[];
  readonly reservationIds: readonly string[];
  readonly paymentAllocationId: string;
  readonly shippingAddress: ShippingAddressSnapshot;
}

export interface OutboxEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: 1;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type CustomerOrderStatus = "CONFIRMED" | "PENDING_PAYMENT";
export type FulfillmentSummaryStatus = "UNFULFILLED";
export type PaymentObligationStatus = "PENDING_COD" | "PENDING";

export interface OrderItem {
  readonly orderItemId: string;
  readonly customerOrderId: string;
  readonly fulfillmentOrderId: string;
  readonly lineIndex: number;
  readonly listingId: string;
  readonly productId: string;
  readonly supplierId: string;
  readonly sellerId: string;
  readonly productName: string;
  readonly listingTitle: string;
  readonly quantity: number;
  readonly unitSalePrice: number;
  readonly unitCostPrice: number;
  readonly lineSaleTotal: number;
  readonly lineCostTotal: number;
  readonly reservationId: string;
  readonly currency: "VND";
}

export interface FulfillmentOrderSnapshot {
  readonly fulfillmentOrderId: string;
  readonly customerOrderId: string;
  readonly supplierId: string;
  readonly sellerId: string;
  readonly status: "PENDING_ACCEPTANCE";
  readonly amountToCollect: number;
  readonly paymentAllocationId: string;
  readonly orderItemIds: readonly string[];
}

export interface CustomerOrder {
  readonly orderId: string;
  readonly orderNo: string;
  readonly customerId: string;
  readonly status: CustomerOrderStatus;
  readonly fulfillmentSummary: FulfillmentSummaryStatus;
  readonly paymentMethod: PaymentMethod;
  readonly paymentStatus: PaymentObligationStatus;
  readonly currency: "VND";
  readonly grandTotal: number;
  readonly totalPayable: number;
  readonly shippingAddress: ShippingAddressSnapshot;
  readonly paymentIntentId?: string;
  readonly createdAt: string;
}

export interface OrderAggregate {
  readonly order: CustomerOrder;
  readonly items: readonly OrderItem[];
  readonly fulfillmentOrders: readonly FulfillmentOrderSnapshot[];
}

