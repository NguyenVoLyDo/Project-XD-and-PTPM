import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cartErrorSchema,
  cartViewSchema,
  putCartItemBodySchema,
} from "../api/contracts";
import {
  InMemoryCartStore,
  MockCartListingProjection,
  MockCurrentActor,
} from "../infrastructure/mocks";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
}

describe("Cart v1 contract harness", () => {
  it("reads the CartView fixture and keeps VND totals as integers", () => {
    const view = cartViewSchema.parse(fixture("cart-view.json"));
    expect(view.estimatedMerchandiseTotal).toBe(300000);
    expect(view.items[0].unitSalePrice).toBe(150000);
  });

  it("reads an error envelope and rejects an invalid quantity", () => {
    const sample = fixture("cart-invalid-quantity.json") as {
      status: number;
      body: unknown;
    };
    expect(sample.status).toBe(400);
    expect(cartErrorSchema.parse(sample.body).error.code).toBe(
      "INVALID_QUANTITY",
    );
    expect(putCartItemBodySchema.safeParse({ quantity: 0 }).success).toBe(
      false,
    );
  });

  it("wires module-local actor, projection and checkout reader mocks", async () => {
    const view = cartViewSchema.parse(fixture("cart-view.json"));
    const customerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const actor = new MockCurrentActor({
      userId: customerId,
      activeRole: "CUSTOMER",
      activeProfileId: null,
    });
    const store = new InMemoryCartStore([
      {
        cartId: view.cartId,
        customerId,
        items: view.items.map(({ listingId, quantity }) => ({
          listingId,
          quantity,
        })),
      },
    ]);
    const projection = new MockCartListingProjection(
      view.items.map(
        ({ listingId, title, unitSalePrice, currency, availability }) => ({
          listingId,
          title,
          unitSalePrice,
          currency,
          availability,
        }),
      ),
    );

    expect((await actor.getCurrentActor())?.userId).toBe(customerId);
    expect(
      (await projection.getForCart([view.items[0].listingId]))[0].title,
    ).toBe(view.items[0].title);
    expect(await store.getForCheckout(customerId)).toEqual({
      cartId: view.cartId,
      items: [{ listingId: view.items[0].listingId, quantity: 2 }],
    });
  });
});
