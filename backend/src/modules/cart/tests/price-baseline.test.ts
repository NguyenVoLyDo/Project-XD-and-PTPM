import { describe, expect, it } from "vitest";
import { CartService } from "../application/cart.service";
import type { ListingProjection } from "../application/ports";
import {
  InMemoryCartStore,
  MockCartListingProjection,
  MockCurrentActor,
} from "../infrastructure/mocks";

const customerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cartId = "11111111-1111-4111-8111-111111111111";
const listingId = "22222222-2222-4222-8222-222222222222";
const goneListingId = "66666666-6666-4666-8666-666666666666";

function setup(projections: ListingProjection[]) {
  const store = new InMemoryCartStore([
    {
      cartId,
      customerId,
      items: [
        { listingId, quantity: 2 },
        { listingId: goneListingId, quantity: 1, lastViewedUnitSalePrice: 90000 },
      ],
    },
  ]);
  const listings = [...projections];
  const service = new CartService(
    new MockCurrentActor({
      userId: customerId,
      activeRole: "CUSTOMER",
      activeProfileId: null,
    }),
    store,
    { getForCart: async (ids) => listings.filter((l) => ids.includes(l.listingId)) },
  );
  return { store, service, listings };
}

const projection = (unitSalePrice: number): ListingProjection => ({
  listingId,
  title: "Tai nghe mẫu",
  unitSalePrice,
  currency: "VND",
  availability: "AVAILABLE",
});

describe("Workflow 3 — Cart price baseline for PRICE_CHANGED", () => {
  it("records the price shown in CartView as an internal baseline", async () => {
    const { store, service } = setup([projection(150000)]);
    const view = await service.getCart();

    // The public CartView stays exactly on contract (no baseline field).
    expect(Object.keys(view.items[0]).sort()).toEqual(
      ["availability", "currency", "listingId", "quantity", "title", "unitSalePrice"],
    );
    expect(await store.getForCheckout(customerId)).toEqual({
      cartId,
      items: [
        { listingId, quantity: 2, lastViewedUnitSalePrice: 150000 },
        // No real price shown for a vanished Listing: its baseline is dropped.
        { listingId: goneListingId, quantity: 1 },
      ],
    });
  });

  it("moves the baseline when the Customer views the cart again", async () => {
    const { store, service, listings } = setup([projection(150000)]);
    await service.getCart();
    listings[0] = projection(160000);
    await service.getCart();
    expect((await store.getForCheckout(customerId))?.items[0]).toEqual({
      listingId,
      quantity: 2,
      lastViewedUnitSalePrice: 160000,
    });
  });

  it("refreshes the baseline on PUT with the price returned to the Customer", async () => {
    const { store, service } = setup([projection(170000)]);
    const view = await service.putItem(listingId, { quantity: 3 });
    expect(view.items[0]).toMatchObject({ quantity: 3, unitSalePrice: 170000 });
    expect((await store.getForCheckout(customerId))?.items[0]).toEqual({
      listingId,
      quantity: 3,
      lastViewedUnitSalePrice: 170000,
    });
  });

  it("still uses the existing projection mock without side effects on reads", async () => {
    const store = new InMemoryCartStore();
    const service = new CartService(
      new MockCurrentActor({
        userId: customerId,
        activeRole: "CUSTOMER",
        activeProfileId: null,
      }),
      store,
      new MockCartListingProjection([projection(150000)]),
    );
    const view = await service.getCart();
    expect(view.items).toEqual([]);
    expect((await store.getForCheckout(customerId))?.items).toEqual([]);
  });
});
