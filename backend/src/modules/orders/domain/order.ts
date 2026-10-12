export type PaymentMethod = "COD" | "ONLINE";

export interface CheckoutCart {
  readonly cartId: string;
  readonly items: readonly {
    readonly listingId: string;
    readonly quantity: number;
  }[];
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
