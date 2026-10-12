export type CartAvailability = "AVAILABLE" | "OUT_OF_STOCK" | "UNAVAILABLE";

export interface CartItem {
  readonly listingId: string;
  readonly quantity: number;
}

export interface CartSnapshot {
  readonly cartId: string;
  readonly customerId: string;
  readonly items: readonly CartItem[];
}

/** Internal handoff: price and availability are deliberately absent. */
export interface CartForCheckout {
  readonly cartId: string;
  readonly items: readonly CartItem[];
}
