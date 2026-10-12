import type { CartForCheckout, CartSnapshot } from "../domain/cart";
import type {
  CartListingProjectionPort,
  CartReaderPort,
  CartStorePort,
  CurrentActor,
  CurrentActorPort,
  ListingProjection,
} from "../application/ports";

export class MockCurrentActor implements CurrentActorPort {
  constructor(public actor: CurrentActor | null) {}
  async getCurrentActor(): Promise<CurrentActor | null> {
    return this.actor;
  }
}

export class InMemoryCartStore implements CartStorePort, CartReaderPort {
  private readonly carts = new Map<string, CartSnapshot>();

  constructor(seed: readonly CartSnapshot[] = []) {
    for (const cart of seed) this.carts.set(cart.customerId, this.copy(cart));
  }

  async getByCustomerId(customerId: string): Promise<CartSnapshot | null> {
    const cart = this.carts.get(customerId);
    return cart ? this.copy(cart) : null;
  }

  async save(cart: CartSnapshot): Promise<void> {
    this.carts.set(cart.customerId, this.copy(cart));
  }

  async getForCheckout(customerId: string): Promise<CartForCheckout | null> {
    const cart = await this.getByCustomerId(customerId);
    return cart
      ? { cartId: cart.cartId, items: cart.items.map((item) => ({ ...item })) }
      : null;
  }

  private copy(cart: CartSnapshot): CartSnapshot {
    return { ...cart, items: cart.items.map((item) => ({ ...item })) };
  }
}

export class MockCartListingProjection implements CartListingProjectionPort {
  constructor(private readonly listings: readonly ListingProjection[]) {}
  async getForCart(
    listingIds: readonly string[],
  ): Promise<readonly ListingProjection[]> {
    return this.listings.filter((listing) =>
      listingIds.includes(listing.listingId),
    );
  }
}
