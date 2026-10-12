import type { CartForCheckout, CartSnapshot } from "../domain/cart";
import type { CartAvailability } from "../domain/cart";

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
