import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkoutIdempotencyKeySchema,
  checkoutQuoteSchema,
  checkoutRequestSchema,
  checkoutResponseSchema,
  customerOrderDetailSchema,
  customerOrderListResponseSchema,
  ordersErrorSchema,
} from "../api/contracts";
import {
  MockCartReader,
  MockCurrentActor,
  MockFulfillment,
  MockIdempotencyStore,
  MockInventory,
  MockListingsQuote,
  MockOutbox,
  MockPayments,
  MockTransaction,
} from "../infrastructure/mocks";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
}

function checkoutFixture(name: string) {
  const sample = fixture(name) as { request: unknown; response: unknown };
  return {
    request: checkoutRequestSchema.parse(sample.request),
    response: checkoutResponseSchema.parse(sample.response),
  };
}

describe("Orders v1 contract harness", () => {
  it.each(["checkout-cod.json", "checkout-online.json"])(
    "reads %s with valid amounts and initial statuses",
    (name) => {
      const { request, response } = checkoutFixture(name);
      expect(checkoutIdempotencyKeySchema.parse("sample-key")).toBe(
        "sample-key",
      );
      expect(checkoutIdempotencyKeySchema.safeParse("").success).toBe(false);
      expect(request.paymentMethod).toBe(response.paymentMethod);
      expect(
        response.fulfillmentOrders.reduce(
          (total, order) => total + order.amountToCollect,
          0,
        ),
      ).toBe(response.totalPayable);
      expect(
        new Set(
          response.fulfillmentOrders.map(
            (order) => `${order.supplierId}/${order.sellerId}`,
          ),
        ).size,
      ).toBe(2);
      if (response.paymentMethod === "ONLINE")
        expect(response.paymentIntentId).toBeTruthy();
    },
  );

  it.each(["price-changed.json", "insufficient-stock.json"])(
    "reads %s as a 409 error envelope",
    (name) => {
      const sample = fixture(name) as { status: number; body: unknown };
      expect(sample.status).toBe(409);
      const { error } = ordersErrorSchema.parse(sample.body);
      expect(error.code).toBe(
        name === "price-changed.json" ? "PRICE_CHANGED" : "INSUFFICIENT_STOCK",
      );
      expect(error.details).toHaveLength(1);
    },
  );

  it("reports the stock error fixture when the Inventory mock cannot hold", async () => {
    const sample = fixture("insufficient-stock.json") as {
      status: number;
      body: unknown;
    };
    const { error } = ordersErrorSchema.parse(sample.body);
    const inventory = new MockInventory(new Map());
    await expect(
      inventory.holdStock(
        new MockTransaction().context,
        "99999999-9999-4999-8999-999999999998",
        "77777777-7777-4777-8777-777777777777",
        1,
        "2026-10-01T10:15:00Z",
      ),
    ).rejects.toMatchObject({ code: error.code, status: sample.status });
    expect(inventory.holds).toHaveLength(0);
  });

  it("wires an Online payment obligation with the Online fixture", async () => {
    const { response } = checkoutFixture("checkout-online.json");
    if (response.paymentMethod !== "ONLINE") throw new Error("Invalid fixture");
    const payments = new MockPayments({
      ONLINE: {
        paymentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        paymentIntentId: response.paymentIntentId,
        status: "PENDING",
        allocationIds: [
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
          "eeeeeeee-1111-4111-8111-111111111111",
        ],
      },
    });
    const result = await payments.createCheckoutObligation(
      new MockTransaction().context,
      response.orderId,
      "ONLINE",
      response.fulfillmentOrders.map((order) => ({
        fulfillmentOrderId: order.fulfillmentOrderId,
        merchandiseAmount: order.amountToCollect,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: order.amountToCollect,
        currency: "VND",
      })),
    );
    expect(result).toMatchObject({
      status: response.paymentStatus,
      paymentIntentId: response.paymentIntentId,
    });
    expect(result.allocationIds).toHaveLength(
      response.fulfillmentOrders.length,
    );
  });

  it("wires local dependency mocks without another module or database", async () => {
    const { request, response } = checkoutFixture("checkout-cod.json");
    const quotes = checkoutQuoteSchema
      .array()
      .parse(fixture("checkout-quotes.json"));
    const customerId = "99999999-9999-4999-8999-999999999999";
    const actor = new MockCurrentActor({
      userId: customerId,
      activeRole: "CUSTOMER",
      activeProfileId: null,
    });
    const cart = new MockCartReader(
      new Map([
        [
          customerId,
          {
            cartId: request.cartId,
            items: quotes.map((quote) => ({
              listingId: quote.listingId,
              quantity: 1,
            })),
          },
        ],
      ]),
    );
    const listings = new MockListingsQuote(quotes);
    const inventory = new MockInventory(new Map([[quotes[0].productId, 2]]));
    const fulfillment = new MockFulfillment();
    const allocationIds = [
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "eeeeeeee-1111-4111-8111-111111111111",
    ];
    const payments = new MockPayments({
      COD: {
        paymentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        paymentIntentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        status: "PENDING_COD",
        allocationIds,
      },
    });
    const outbox = new MockOutbox();
    const idempotency = new MockIdempotencyStore();
    const transaction = new MockTransaction();

    expect((await actor.getCurrentActor())?.userId).toBe(customerId);
    expect((await cart.getForCheckout(customerId))?.items).toHaveLength(2);
    await transaction.runInTransaction(async (context) => {
      expect(
        (
          await listings.getCheckoutQuotes(
            quotes.map((quote) => quote.listingId),
            context,
          )
        ).quotes,
      ).toHaveLength(2);
      expect(await inventory.getAvailability(quotes[0].productId)).toBe(2);
      const orderItemIds = [
        "99999999-9999-4999-8999-999999999998",
        "99999999-9999-4999-8999-999999999997",
      ];
      const holds = await Promise.all(
        orderItemIds.map((orderItemId) =>
          inventory.holdStock(
            context,
            orderItemId,
            quotes[0].productId,
            1,
            "2026-10-01T10:15:00Z",
          ),
        ),
      );
      expect(holds.every((hold) => hold.status === "HELD")).toBe(true);
      expect(new Set(holds.map((hold) => hold.reservationId)).size).toBe(2);
      expect(await inventory.getAvailability(quotes[0].productId)).toBe(0);
      expect(
        await inventory.holdStock(
          context,
          orderItemIds[0],
          quotes[0].productId,
          1,
          "2026-10-01T10:15:00Z",
        ),
      ).toEqual(holds[0]);
      const allocations = response.fulfillmentOrders.map((order) => ({
        fulfillmentOrderId: order.fulfillmentOrderId,
        merchandiseAmount: order.amountToCollect,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: order.amountToCollect,
        currency: "VND" as const,
      }));
      const obligation = await payments.createCheckoutObligation(
        context,
        response.orderId,
        "COD",
        allocations,
      );
      expect(obligation.status).toBe("PENDING_COD");
      expect(obligation.allocationIds).toHaveLength(allocations.length);
      await fulfillment.createInitialInCheckout(
        context,
        response.fulfillmentOrders.map((order, index) => ({
          ...order,
          customerOrderId: response.orderId,
          orderItemIds: [orderItemIds[index]],
          reservationIds: [holds[index].reservationId],
          paymentAllocationId: obligation.allocationIds[index],
          shippingAddress: request.shippingAddress,
        })),
      );
      await outbox.add(context, {
        eventId: "11111111-1111-4111-8111-111111111111",
        eventType: "OrderCreated",
        eventVersion: 1,
        aggregateId: response.orderId,
        occurredAt: "2026-10-01T10:00:00Z",
        correlationId: "22222222-2222-4222-8222-222222222222",
        payload: { orderId: response.orderId },
      });
      await idempotency.save(context, {
        customerId,
        key: "sample-key",
        requestHash: "sample-hash",
        response,
      });
    });
    expect(transaction.calls).toBe(1);
    expect(fulfillment.groups).toHaveLength(2);
    expect(inventory.holds).toHaveLength(2);
    expect(
      new Set(fulfillment.groups.map((group) => group.paymentAllocationId))
        .size,
    ).toBe(2);
    expect(payments.calls).toHaveLength(1);
    expect(outbox.events).toHaveLength(1);
    expect(
      (await idempotency.find(customerId, "sample-key"))?.response.orderId,
    ).toBe(response.orderId);
  });

  it("validates order-detail.json against customerOrderDetailSchema", () => {
    const data = fixture("order-detail.json");
    const parsed = customerOrderDetailSchema.parse(data);
    expect(parsed.orderId).toBe("33333333-3333-4333-8333-333333333333");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.fulfillmentOrders).toHaveLength(2);
    expect(parsed.totalPayable).toBe(300000);
  });

  it("validates order-list.json against customerOrderListResponseSchema", () => {
    const data = fixture("order-list.json");
    const parsed = customerOrderListResponseSchema.parse(data);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.pagination.total).toBe(1);
    expect(parsed.pagination.page).toBe(1);
  });
});
