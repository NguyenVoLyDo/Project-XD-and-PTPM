import type { CartForCheckout, CartSnapshot } from "../domain/cart";
import type { CartAvailability } from "../domain/cart";

export const CART_CURRENT_ACTOR = Symbol("CART_CURRENT_ACTOR");
export const CART_STORE = Symbol("CART_STORE");
export const CART_LISTING_PROJECTION = Symbol("CART_LISTING_PROJECTION");

export interface CurrentActor {
  readonly userId: string;
  readonly activeRole: string;
  readonly activeProfileId: string | null;
}

export interface CurrentActorPort {
  getCurrentActor(): Promise<CurrentActor | null>;
}

export interface CartStorePort {
  getByCustomerId(customerId: string): Promise<CartSnapshot | null>;
  save(cart: CartSnapshot): Promise<void>;
}

export interface ListingProjection {
  readonly listingId: string;
  readonly title: string;
  readonly unitSalePrice: number;
  readonly currency: "VND";
  readonly availability: CartAvailability;
  /** Set by the Listings adapter when an unavailable listing has a specific cause. */
  readonly unavailableCode?: "LISTING_UNAVAILABLE" | "LISTING_PAUSED_BY_POLICY";
}

/** A CartView projection. It cannot authorize checkout or reserve stock. */
export interface CartListingProjectionPort {
  getForCart(
    listingIds: readonly string[],
  ): Promise<readonly ListingProjection[]>;
}

/** Public consumer-facing port for Orders; implemented by Cart in Workflow 2. */
export interface CartReaderPort {
  getForCheckout(customerId: string): Promise<CartForCheckout | null>;
}
