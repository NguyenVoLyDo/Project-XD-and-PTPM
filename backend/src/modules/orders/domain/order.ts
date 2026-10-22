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

export type CustomerOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PAYMENT_FAILED"
  | "PROCESSING"
  | "CANCELED"
  | "CLOSED";

export type FulfillmentSummaryStatus =
  | "UNFULFILLED"
  | "PARTIALLY_CANCELED"
  | "PARTIALLY_FULFILLED"
  | "PARTIALLY_COMPLETED"
  | "FULFILLED"
  | "RETURN_IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED";

export type PaymentStatus =
  | "PENDING"
  | "PENDING_COD"
  | "PAID"
  | "FAILED"
  | "COLLECTED"
  | "VOIDED"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type PaymentObligationStatus = PaymentStatus;

export type FulfillmentOrderStatus =
  | "PENDING_ACCEPTANCE"
  | "ACCEPTED"
  | "PACKING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURN_REQUESTED"
  | "RETURNING"
  | "RETURNED"
  | "REFUNDED"
  | "REJECTED"
  | "CANCELED";

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
  readonly status: FulfillmentOrderStatus;
  readonly amountToCollect: number;
  readonly paymentAllocationId: string;
  readonly orderItemIds: readonly string[];
  readonly reasonCode?: string;
  readonly sourceRef?: string;
  readonly trackingNo?: string;
  readonly carrierCode?: string;
  readonly updatedAt?: string;
}

export interface CustomerOrder {
  readonly orderId: string;
  readonly orderNo: string;
  readonly customerId: string;
  readonly status: CustomerOrderStatus;
  readonly fulfillmentSummary: FulfillmentSummaryStatus;
  readonly paymentMethod: PaymentMethod;
  readonly paymentStatus: PaymentStatus;
  readonly currency: "VND";
  readonly grandTotal: number;
  readonly totalPayable: number;
  readonly shippingAddress: ShippingAddressSnapshot;
  readonly paymentIntentId?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface OrderAggregate {
  readonly order: CustomerOrder;
  readonly items: readonly OrderItem[];
  readonly fulfillmentOrders: readonly FulfillmentOrderSnapshot[];
}

export interface DomainEventEnvelope<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: 1;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly payload: T;
}

export interface PaymentSucceededPayload {
  readonly orderId: string;
  readonly paymentId?: string;
  readonly paymentIntentId?: string;
  readonly paidAmount?: number;
}

export interface PaymentFailedPayload {
  readonly orderId: string;
  readonly paymentId?: string;
  readonly reasonCode?: string;
  readonly sourceRef?: string;
}

export interface PaymentTimedOutPayload {
  readonly orderId: string;
  readonly reasonCode?: string;
  readonly sourceRef?: string;
}

export interface PaymentCollectedPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId?: string;
  readonly paymentAllocationId?: string;
  readonly amountCollected?: number;
}

export interface RefundCompletedPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId?: string;
  readonly paymentAllocationId?: string;
  readonly refundId?: string;
  readonly amount?: number;
  readonly reasonCode?: string;
  readonly sourceRef?: string;
}

export interface FulfillmentAcceptedPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId: string;
  readonly supplierId?: string;
}

export interface FulfillmentRejectedPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId: string;
  readonly reasonCode: string;
  readonly sourceRef?: string;
}

export interface FulfillmentTimedOutPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId: string;
  readonly reasonCode?: string;
  readonly sourceRef?: string;
}

export interface FulfillmentShippedPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId: string;
  readonly trackingNo: string;
  readonly carrierCode?: string;
}

export interface FulfillmentDeliveredPayload {
  readonly orderId: string;
  readonly fulfillmentOrderId: string;
  readonly deliveredAt?: string;
}


