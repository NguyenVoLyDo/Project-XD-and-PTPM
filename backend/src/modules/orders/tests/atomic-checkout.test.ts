import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CheckoutController } from "../api/checkout.controller";
import {
  checkoutQuoteSchema,
  checkoutRequestSchema,
  checkoutResponseSchema,
  ordersErrorSchema,
} from "../api/contracts";
import { AtomicCheckoutService } from "../application/atomic-checkout.service";
import { CheckoutQuoteService } from "../application/checkout-quote.service";
import { CheckoutService } from "../application/checkout.service";
import type { CheckoutCart, CheckoutQuote } from "../domain/order";
import {
  MockCartReader,
  MockCurrentActor,
  MockFulfillment,
  MockIdempotencyStore,
  MockInventory,
  MockListingsQuote,
  MockOrderRepository,
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

const customerId = "99999999-9999-4999-8999-999999999999";
const cartId = "11111111-1111-4111-8111-111111111111";
const quotes: CheckoutQuote[] = checkoutQuoteSchema
  .array()
  .parse(fixture("checkout-quotes.json"));
const [listingA, listingB] = quotes; // same Supplier, 2 different Sellers
const productId = listingA.productId;

interface HarnessOptions {
  readonly initialStock?: number;
  readonly cart?: CheckoutCart | null;
}

function harness(options: HarnessOptions = {}) {
  const defaultCart: CheckoutCart = {
    cartId,
    items: quotes.map((q) => ({
      listingId: q.listingId,
      quantity: 1,
      lastViewedUnitSalePrice: q.unitSalePrice,
    })),
  };
  const cart = options.cart === undefined ? defaultCart : options.cart;
  const carts = new Map<string, CheckoutCart>();
  if (cart) carts.set(customerId, cart);

  const cartReader = new MockCartReader(carts);
  const listingsQuote = new MockListingsQuote(quotes);
  const initialStock = options.initialStock ?? 5;
  const inventory = new MockInventory(new Map([[productId, initialStock]]));
  const transaction = new MockTransaction();
  const quoteService = new CheckoutQuoteService(
    cartReader,
    listingsQuote,
    inventory,
  );

  const payments = new MockPayments({
    COD: {
      paymentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      paymentIntentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      status: "PENDING_COD",
      allocationIds: [
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        "eeeeeeee-1111-4111-8111-111111111111",
      ],
    },
    ONLINE: {
      paymentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      paymentIntentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      status: "PENDING",
      allocationIds: [
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        "eeeeeeee-1111-4111-8111-111111111111",
      ],
    },
  });

  const fulfillment = new MockFulfillment();
  const outbox = new MockOutbox();
  const idempotency = new MockIdempotencyStore();
  const orderRepository = new MockOrderRepository();

  const atomicService = new AtomicCheckoutService(
    quoteService,
    transaction,
    inventory,
    payments,
    fulfillment,
    outbox,
    idempotency,
    orderRepository,
  );

  const currentActor = new MockCurrentActor({
    userId: customerId,
    activeRole: "CUSTOMER",
    activeProfileId: null,
  });

  const checkoutService = new CheckoutService(
    currentActor,
    idempotency,
    atomicService,
  );

  const controller = new CheckoutController(checkoutService);

  return {
    cartReader,
    listingsQuote,
    inventory,
    transaction,
    quoteService,
    payments,
    fulfillment,
    outbox,
    idempotency,
    orderRepository,
    atomicService,
    checkoutService,
    controller,
    initialStock,
  };
}

async function captureError(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error("Expected operation to fail");
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

describe("Workflow 5 — Atomic Checkout and CustomerOrder Creation", () => {
  it("creates 1 CustomerOrder + 2 FulfillmentOrders for same Supplier, different Sellers (COD)", async () => {
    const h = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    const response = await h.checkoutService.checkout("cod-key-1", request);

    // 1. Verify response structure and contract schema compliance
    expect(checkoutResponseSchema.parse(response)).toEqual(response);
    expect(response.paymentMethod).toBe("COD");
    expect(response.status).toBe("CONFIRMED");
    expect(response.paymentStatus).toBe("PENDING_COD");
    expect(response.fulfillmentSummary).toBe("UNFULFILLED");
    expect(response.totalPayable).toBe(300000);
    expect(response.currency).toBe("VND");

    // 2. Verify splitting by (supplierId, sellerId): exactly 2 FulfillmentOrders
    expect(response.fulfillmentOrders).toHaveLength(2);
    const [foA, foB] = response.fulfillmentOrders;
    expect(foA.supplierId).toBe(listingA.supplierId);
    expect(foA.sellerId).toBe(listingA.sellerId);
    expect(foA.status).toBe("PENDING_ACCEPTANCE");
    expect(foA.amountToCollect).toBe(150000);

    expect(foB.supplierId).toBe(listingB.supplierId);
    expect(foB.sellerId).toBe(listingB.sellerId);
    expect(foB.status).toBe("PENDING_ACCEPTANCE");
    expect(foB.amountToCollect).toBe(150000);

    // Sum of amounts matches totalPayable
    expect(foA.amountToCollect + foB.amountToCollect).toBe(response.totalPayable);

    // 3. Verify Inventory hold
    expect(h.inventory.holds).toHaveLength(2);
    expect(h.inventory.holds.every((h) => h.status === "HELD")).toBe(true);
    expect(await h.inventory.getAvailability(productId)).toBe(h.initialStock - 2);

    // 4. Verify Payments obligation
    expect(h.payments.calls).toHaveLength(1);
    expect(h.payments.calls[0]).toMatchObject({
      orderId: response.orderId,
      method: "COD",
    });
    expect(h.payments.calls[0].allocations).toHaveLength(2);
    expect(h.payments.calls[0].allocations[0].amountToCollect).toBe(150000);
    expect(h.payments.calls[0].allocations[1].amountToCollect).toBe(150000);

    // 5. Verify Fulfillment initial groups
    expect(h.fulfillment.groups).toHaveLength(2);
    expect(h.fulfillment.groups[0].shippingAddress).toEqual(request.shippingAddress);
    expect(h.fulfillment.groups[1].shippingAddress).toEqual(request.shippingAddress);

    // 6. Verify Outbox OrderCreated event
    expect(h.outbox.events).toHaveLength(1);
    expect(h.outbox.events[0]).toMatchObject({
      eventType: "OrderCreated",
      aggregateId: response.orderId,
      payload: {
        orderId: response.orderId,
        fulfillmentOrderIds: response.fulfillmentOrders.map((f) => f.fulfillmentOrderId),
      },
    });

    // 7. Verify Idempotency record saved
    const record = await h.idempotency.find(customerId, "cod-key-1");
    expect(record).not.toBeNull();
    expect(record?.response).toEqual(response);

    // 8. Verify OrderRepository aggregate persistence
    const saved = await h.orderRepository.findById(response.orderId);
    expect(saved).not.toBeNull();
    expect(saved?.order.orderId).toBe(response.orderId);
    expect(saved?.order.status).toBe("CONFIRMED");
    expect(saved?.items).toHaveLength(2);
    expect(saved?.items[0].unitSalePrice).toBe(150000);
    expect(saved?.items[0].unitCostPrice).toBe(100000);
    expect(saved?.fulfillmentOrders).toHaveLength(2);
  });

  it("creates Online checkout with PENDING_PAYMENT status and paymentIntentId", async () => {
    const h = harness();
    const { request } = checkoutFixture("checkout-online.json");

    const response = await h.checkoutService.checkout("online-key-1", request);

    expect(checkoutResponseSchema.parse(response)).toEqual(response);
    expect(response.paymentMethod).toBe("ONLINE");
    expect(response.status).toBe("PENDING_PAYMENT");
    expect(response.paymentStatus).toBe("PENDING");
    if (response.paymentMethod === "ONLINE") {
      expect(response.paymentIntentId).toBe("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    }
    expect(response.totalPayable).toBe(300000);
    expect(response.fulfillmentOrders).toHaveLength(2);

    const saved = await h.orderRepository.findById(response.orderId);
    expect(saved?.order.paymentIntentId).toBe("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("rolls back all changes when Inventory holdStock fails", async () => {
    // Only 1 item in stock, but cart requests 2
    const h = harness({ initialStock: 1 });
    const { request } = checkoutFixture("checkout-cod.json");

    const { status, body } = await captureError(
      h.checkoutService.checkout("fail-stock-key", request),
    );

    expect(status).toBe(409);
    expect(body.error.code).toBe("INSUFFICIENT_STOCK");

    // Atomicity check: all side-effects rolled back
    expect(h.inventory.holds).toHaveLength(0);
    expect(await h.inventory.getAvailability(productId)).toBe(1); // restored
    expect(h.payments.calls).toHaveLength(0);
    expect(h.fulfillment.groups).toHaveLength(0);
    expect(h.outbox.events).toHaveLength(0);
    expect(await h.idempotency.find(customerId, "fail-stock-key")).toBeNull();
    expect(h.orderRepository.orders.size).toBe(0);
  });

  it("rolls back inventory hold and all state when Payments obligation fails", async () => {
    const h = harness();
    h.payments.failNext = true; // simulate payment service failure
    const { request } = checkoutFixture("checkout-cod.json");

    await expect(
      h.checkoutService.checkout("fail-payment-key", request),
    ).rejects.toThrow("PAYMENT_SERVICE_UNAVAILABLE");

    // Atomicity check: inventory hold was rolled back, stock restored
    expect(h.inventory.holds).toHaveLength(0);
    expect(await h.inventory.getAvailability(productId)).toBe(h.initialStock);
    expect(h.payments.calls).toHaveLength(0);
    expect(h.fulfillment.groups).toHaveLength(0);
    expect(h.outbox.events).toHaveLength(0);
    expect(await h.idempotency.find(customerId, "fail-payment-key")).toBeNull();
    expect(h.orderRepository.orders.size).toBe(0);
  });

  it("rolls back inventory, payments, and all state when Fulfillment fails", async () => {
    const h = harness();
    h.fulfillment.failNext = true; // simulate fulfillment service failure
    const { request } = checkoutFixture("checkout-cod.json");

    await expect(
      h.checkoutService.checkout("fail-fulfillment-key", request),
    ).rejects.toThrow("FULFILLMENT_UNAVAILABLE");

    // Atomicity check: inventory & payments rolled back
    expect(h.inventory.holds).toHaveLength(0);
    expect(await h.inventory.getAvailability(productId)).toBe(h.initialStock);
    expect(h.payments.calls).toHaveLength(0);
    expect(h.fulfillment.groups).toHaveLength(0);
    expect(h.outbox.events).toHaveLength(0);
    expect(await h.idempotency.find(customerId, "fail-fulfillment-key")).toBeNull();
    expect(h.orderRepository.orders.size).toBe(0);
  });

  it("rolls back all state when Outbox fails", async () => {
    const h = harness();
    h.outbox.failNext = true; // simulate outbox failure
    const { request } = checkoutFixture("checkout-cod.json");

    await expect(
      h.checkoutService.checkout("fail-outbox-key", request),
    ).rejects.toThrow("OUTBOX_ERROR");

    // Atomicity check: everything undone
    expect(h.inventory.holds).toHaveLength(0);
    expect(await h.inventory.getAvailability(productId)).toBe(h.initialStock);
    expect(h.payments.calls).toHaveLength(0);
    expect(h.fulfillment.groups).toHaveLength(0);
    expect(h.outbox.events).toHaveLength(0);
    expect(await h.idempotency.find(customerId, "fail-outbox-key")).toBeNull();
    expect(h.orderRepository.orders.size).toBe(0);
  });

  it("integrates end-to-end through CheckoutController and supports replay", async () => {
    const h = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    // 1. First call through HTTP controller
    const first = await h.controller.checkout(
      { "idempotency-key": "e2e-controller-key" },
      request,
    );
    expect(first.status).toBe("CONFIRMED");
    expect(h.inventory.holds).toHaveLength(2);
    expect(h.payments.calls).toHaveLength(1);

    // 2. Second call with same key and body (replay)
    const replay = await h.controller.checkout(
      { "idempotency-key": "e2e-controller-key" },
      request,
    );

    // Replay returns the exact same stored response without calling ports again
    expect(replay).toEqual(first);
    expect(h.inventory.holds).toHaveLength(2); // still 2, not 4
    expect(h.payments.calls).toHaveLength(1); // still 1, not 2
    expect(h.outbox.events).toHaveLength(1); // still 1, not 2
  });
});
