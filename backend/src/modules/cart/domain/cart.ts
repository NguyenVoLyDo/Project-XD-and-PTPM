export type CartAvailability = "AVAILABLE" | "OUT_OF_STOCK" | "UNAVAILABLE";

export interface CartItem {
  readonly listingId: string;
  readonly quantity: number;
  /**
   * Internal baseline: the unitSalePrice last returned to the Customer in a
   * CartView. It is NOT a locked price and never leaves the backend; Orders
   * only compares it with the server quote to detect PRICE_CHANGED.
   * Absent when the Customer has not yet seen a price for this item.
   */
  readonly lastViewedUnitSalePrice?: number;
}

export interface CartSnapshot {
  readonly cartId: string;
  readonly customerId: string;
  readonly items: readonly CartItem[];
}

/**
 * Internal handoff to Orders. Current price and availability are deliberately
 * absent; only the last-viewed baseline is passed for PRICE_CHANGED detection.
 */
export interface CartForCheckout {
  readonly cartId: string;
  readonly items: readonly CartItem[];
}
