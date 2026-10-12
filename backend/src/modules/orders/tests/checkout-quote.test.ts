import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { checkoutQuoteSchema, ordersErrorSchema } from "../api/contracts";
import { CheckoutQuoteService } from "../application/checkout-quote.service";
import type { CheckoutCart, CheckoutQuote } from "../domain/order";
import {
  MockCartReader,
  MockInventory,
  MockListingsQuote,
  MockTransaction,
} from "../infrastructure/mocks";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
}

const customerId = "99999999-9999-4999-8999-999999999999";
const cartId = "11111111-1111-4111-8111-111111111111";
const quotes: CheckoutQuote[] = checkoutQuoteSchema
  .array()
  .parse(fixture("checkout-quotes.json"));
const [listingA, listingB] = quotes; // same Supplier + Product, two Sellers
const productId = listingA.productId;

interface HarnessOptions {
  readonly cart?: CheckoutCart | null;
  readonly stock?: number;
}

function harness(options: HarnessOptions = {}) {
  const cart =
    options.cart === undefined
      ? {
          cartId,
          items: quotes.map((quote) => ({
            listingId: quote.listingId,
            quantity: 1,
            lastViewedUnitSalePrice: quote.unitSalePrice,
          })),
        }
      : options.cart;
  const carts = new Map<string, CheckoutCart>();
  if (cart) carts.set(customerId, cart);
  const listings = new MockListingsQuote(quotes);
  const inventory = new MockInventory(new Map([[productId, options.stock ?? 5]]));
  const transaction = new MockTransaction();
  const service = new CheckoutQuoteService(
    new MockCartReader(carts),
    listings,
    inventory,
  );
  const quote = (id = cartId) =>
    transaction.runInTransaction((context) =>
      service.quote(customerId, id, context),
    );
  return { listings, inventory, transaction, quote };
}

async function captureError(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error("Expected checkout quote to fail");
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  return {
    status: http.getStatus(),
    body: ordersErrorSchema.parse(http.getResponse()),
  };
}

describe("Workflow 3 — revalidate Cart and checkout quote", () => {
  it("builds a server quote with integer VND totals and quote-owned data", async () => {
    const { quote, listings, transaction } = harness();
    const result = await quote();

    expect(result).toMatchObject({
      customerId,
      cartId,
      merchandiseTotal: 300000,
      currency: "VND",
    });
    expect(result.lines).toHaveLength(2);
    expect(result.lines.map((line) => line.sellerId)).toEqual([
      listingA.sellerId,
      listingB.sellerId,
    ]);
    expect(result.lines[1]).toEqual({
      lineIndex: 1,
      listingId: listingB.listingId,
      productId,
      supplierId: listingB.supplierId,
      sellerId: listingB.sellerId,
      productName: listingB.productName,
      listingTitle: listingB.listingTitle,
      quantity: 1,
      unitSalePrice: 150000,
      unitCostPrice: 100000,
      lineSaleTotal: 150000,
      lineCostTotal: 100000,
      currency: "VND",
    });
    for (const line of result.lines) {
      expect(Number.isSafeInteger(line.lineSaleTotal)).toBe(true);
    }
    // Listings is consulted with the checkout transaction context.
    expect(listings.contexts).toEqual([transaction.context]);
  });

  it("returns the PRICE_CHANGED fixture when the price moves after CartView", async () => {
    const sample = fixture("price-changed.json") as {
      status: number;
      body: unknown;
    };
    const { quote, listings } = harness();
    listings.setSalePrice(listingA.listingId, 160000);

    expect(await captureError(quote())).toEqual({
      status: sample.status,
      body: sample.body,
    });
  });

  it("never treats the Cart baseline as the payable price", async () => {
    // Baseline lower than the current quote: still a PRICE_CHANGED, not 140000.
    const { quote } = harness({
      cart: {
        cartId,
        items: [
          {
            listingId: listingA.listingId,
            quantity: 1,
            lastViewedUnitSalePrice: 140000,
          },
        ],
      },
    });
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error.details[0]).toMatchObject({
      code: "PRICE_CHANGED",
      currentUnitSalePrice: 150000,
    });
  });

  it("requires confirmation when an old cart item has no price baseline", async () => {
    const { quote } = harness({
      cart: { cartId, items: [{ listingId: listingA.listingId, quantity: 1 }] },
    });
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error.code).toBe("PRICE_CHANGED");
  });

  it.each([
    ["no cart", null],
    ["an empty cart", { cartId, items: [] }],
  ])("returns 409 EMPTY_CART for %s", async (_label, cart) => {
    const { quote, listings } = harness({ cart });
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error.code).toBe("EMPTY_CART");
    expect(listings.contexts).toHaveLength(0);
  });

  it("rejects a cartId that is not the Customer's current cart", async () => {
    const { quote } = harness();
    const { status, body } = await captureError(
      quote("12121212-1212-4212-8212-121212121212"),
    );
    expect(status).toBe(400);
    expect(body.error).toMatchObject({
      code: "INVALID_REQUEST",
      details: [{ field: "cartId", code: "CART_MISMATCH" }],
    });
  });

  it("blocks a Listing paused by policy", async () => {
    const { quote, listings } = harness();
    listings.reject(listingB.listingId, "LISTING_PAUSED_BY_POLICY");
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error).toMatchObject({
      code: "LISTING_PAUSED_BY_POLICY",
      details: [
        {
          field: "items[1]",
          code: "LISTING_PAUSED_BY_POLICY",
          listingId: listingB.listingId,
        },
      ],
    });
  });

  it.each([
    ["Listing removed (LISTING_NOT_FOUND)", "LISTING_NOT_FOUND"],
    ["Listing inactive (LISTING_UNAVAILABLE)", "LISTING_UNAVAILABLE"],
  ] as const)("maps %s to 409 LISTING_UNAVAILABLE", async (_label, code) => {
    const { quote, listings } = harness();
    listings.reject(listingA.listingId, code);
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error.code).toBe("LISTING_UNAVAILABLE");
    expect(body.error.details).toEqual([
      { field: "items[0]", code, listingId: listingA.listingId },
    ]);
  });

  it("treats a quote silently omitted by Listings as unavailable", async () => {
    const quoteService = new CheckoutQuoteService(
      new MockCartReader(
        new Map([
          [
            customerId,
            {
              cartId,
              items: [
                {
                  listingId: listingA.listingId,
                  quantity: 1,
                  lastViewedUnitSalePrice: 150000,
                },
              ],
            },
          ],
        ]),
      ),
      { getCheckoutQuotes: async () => ({ quotes: [], rejections: [] }) },
      new MockInventory(new Map([[productId, 5]])),
    );
    const { status, body } = await captureError(
      quoteService.quote(customerId, cartId, new MockTransaction().context),
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe("LISTING_UNAVAILABLE");
  });

  it("returns the INSUFFICIENT_STOCK fixture when stock is gone", async () => {
    const sample = fixture("insufficient-stock.json") as {
      status: number;
      body: unknown;
    };
    const { quote } = harness({
      stock: 0,
      cart: {
        cartId,
        items: [
          {
            listingId: listingA.listingId,
            quantity: 1,
            lastViewedUnitSalePrice: 150000,
          },
        ],
      },
    });
    expect(await captureError(quote())).toEqual({
      status: sample.status,
      body: sample.body,
    });
  });

  it("checks stock per Product across Listings of different Sellers", async () => {
    // Each line alone fits (1 <= 1) but together they need 2 units.
    const { quote, inventory } = harness({ stock: 1 });
    const { status, body } = await captureError(quote());
    expect(status).toBe(409);
    expect(body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(body.error.details).toEqual([
      expect.objectContaining({ field: "items[0]", availableQuantity: 1 }),
      expect.objectContaining({ field: "items[1]", availableQuantity: 1 }),
    ]);
    // Workflow 3 is read-only: no reservation is taken here.
    expect(inventory.holds).toHaveLength(0);
  });

  it("reports every failing item and picks the top code by priority", async () => {
    const { quote, listings } = harness();
    listings.setSalePrice(listingA.listingId, 160000);
    listings.reject(listingB.listingId, "LISTING_PAUSED_BY_POLICY");
    const { body } = await captureError(quote());
    expect(body.error.code).toBe("LISTING_PAUSED_BY_POLICY");
    expect(body.error.details.map((detail) => detail.code)).toEqual([
      "PRICE_CHANGED",
      "LISTING_PAUSED_BY_POLICY",
    ]);
  });

  it("fails closed on malformed Listings quotes", async () => {
    const broken = { ...listingA, unitSalePrice: 150000.5 };
    const quoteService = new CheckoutQuoteService(
      new MockCartReader(
        new Map([
          [
            customerId,
            {
              cartId,
              items: [
                {
                  listingId: listingA.listingId,
                  quantity: 1,
                  lastViewedUnitSalePrice: 150000,
                },
              ],
            },
          ],
        ]),
      ),
      new MockListingsQuote([broken]),
      new MockInventory(new Map([[productId, 5]])),
    );
    const { status, body } = await captureError(
      quoteService.quote(customerId, cartId, new MockTransaction().context),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("LISTING_QUOTE_INVALID");
  });
});
