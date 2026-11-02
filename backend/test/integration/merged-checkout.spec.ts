import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DemoAppModule as AppModule } from "../../src/demo-app.module";
import { StoreService } from "../../src/common/database/store.service";
import { GlobalExceptionFilter } from "../../src/common/errors/http-exception.filter";
import { ResponseTransformInterceptor } from "../../src/common/http/response.interceptor";
import { DemoCheckoutState, OrdersIdempotencyAdapter } from "../../src/integration/store-adapters.service";

const customer = { "x-user-id": "u-customer-c", "x-role": "CUSTOMER" };
const shippingAddress = { recipientName: "Test Customer", phone: "0901234567", line1: "1 Test Street", wardCode: "001", provinceCode: "01" };

describe("Son + Quyen integration using the local in-memory demo adapters", () => {
  let app: INestApplication;
  let store: StoreService;
  let state: DemoCheckoutState;
  beforeEach(async () => {
    vi.stubEnv("DEMO_AUTH_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "test");
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();
    store = app.get(StoreService);
    state = app.get(DemoCheckoutState);
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await app?.close(); });

  async function cart(quantity = 2, multiSupplier = false) {
    const selected = multiSupplier ? [store.listings[0], store.listings[1]] : [store.listings[0]];
    let cartId = "";
    for (const listing of selected) {
      const response = await request(app.getHttpServer()).put(`/api/v1/cart/items/${listing.id}`).set(customer).send({ quantity });
      expect(response.status).toBe(200);
      cartId = response.body.data.cartId;
    }
    return { cartId, shippingAddress, paymentMethod: "COD" };
  }
  function checkout(body: object, key: string) {
    return request(app.getHttpServer()).post("/api/v1/checkout").set(customer).set("Idempotency-Key", key).send(body);
  }

  it("creates one parent and two supplier groups with real item quantities, snapshots and COD TTL", async () => {
    const body = await cart(2, true);
    const response = await checkout(body, "split");
    expect(response.status).toBe(201);
    const order = response.body.data;
    expect(order.fulfillmentOrders).toHaveLength(2);
    const items = store.orderItems.filter((item) => item.customerOrderId === order.orderId);
    expect(items).toHaveLength(2);
    for (const item of items) {
      const fulfillment = store.fulfillmentItems.find((line) => line.orderItemId === item.id)!;
      expect(fulfillment.quantity).toBe(2);
      expect(fulfillment.itemGrossSnapshot).toBe(item.unitSalePriceSnapshot * 2);
      const hold = store.stockReservations.find((hold) => hold.orderItemId === item.id)!;
      expect(Date.parse(hold.expiresAt) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    }
    expect(store.fulfillmentOrders.filter((fo) => fo.customerOrderId === order.orderId).every((fo) => fo.status === "PENDING_ACCEPTANCE")).toBe(true);
    const detail = await request(app.getHttpServer()).get(`/api/v1/orders/${order.orderId}`).set(customer);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain("unitCostPrice");
  });

  it("keeps Online holds at 15 minutes and maps the demo payment method", async () => {
    const body = { ...await cart(), paymentMethod: "ONLINE" };
    const response = await checkout(body, "online");
    expect(response.status).toBe(201);
    const payment = store.payments.find((payment) => payment.customerOrderId === response.body.data.orderId)!;
    expect(payment.method).toBe("ONLINE_MOCK");
    const remaining = Date.parse(store.stockReservations.at(-1)!.expiresAt) - Date.now();
    expect(remaining).toBeGreaterThan(14 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("replays two simultaneous identical requests without duplicate side effects", async () => {
    const body = await cart();
    const [first, second] = await Promise.all([checkout(body, "same"), checkout(body, "same")]);
    expect(first.status).toBe(201);
    expect(second.body.data.orderId).toBe(first.body.data.orderId);
    expect(state.orders.size).toBe(1);
    expect(state.outbox).toHaveLength(1);
    const changed = await checkout({ ...body, paymentMethod: "ONLINE" }, "same");
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("lets only one checkout reserve the last unit in the single-process demo", async () => {
    const product = store.products.find((p) => p.id === store.listings[0].productId)!;
    product.availableStock = 1;
    const body = await cart(1);
    const results = await Promise.all([checkout(body, "race-a"), checkout(body, "race-b")]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(state.orders.size).toBe(1);
    expect(store.stockReservations.reduce((sum, hold) => sum + hold.quantity, 0)).toBe(1);
  });

  it("rolls back all checkout stores, outbox and idempotency after a late failure, then permits retry", async () => {
    const body = await cart();
    const fields = ["customerOrders", "orderItems", "stockReservations", "fulfillmentOrders", "fulfillmentItems", "payments", "paymentAllocations"] as const;
    const before = fields.map((field) => structuredClone(store[field]));
    const adapter = app.get(OrdersIdempotencyAdapter);
    const save = adapter.save.bind(adapter);
    const failure = vi.spyOn(adapter, "save").mockImplementationOnce(async (context, record) => { await save(context, record); throw new Error("Injected late failure"); });
    const response = await checkout(body, "retry");
    expect(response.status).toBe(500);
    fields.forEach((field, index) => expect(store[field]).toEqual(before[index]));
    expect(state.orders.size).toBe(0);
    expect(state.idempotency.size).toBe(0);
    expect(state.outbox).toHaveLength(0);
    failure.mockRestore();
    expect((await checkout(body, "retry")).status).toBe(201);
  });

  it("rejects anonymous and nonexistent actors, invalid role membership, and cross-customer order reads", async () => {
    expect((await request(app.getHttpServer()).get("/api/v1/cart")).status).toBe(401);
    expect((await request(app.getHttpServer()).get("/api/v1/cart").set({ ...customer, "x-user-id": "nonexistent" })).status).toBe(401);
    expect((await request(app.getHttpServer()).get("/api/v1/cart").set({ ...customer, "x-role": "SUPPLIER" })).status).toBe(403);
    const body = await cart();
    const order = await checkout(body, "ownership");
    store.users.push({ ...store.users.find((user) => user.id === customer["x-user-id"])!, id: "customer-other" });
    store.userRoles.push({ ...store.userRoles.find((role) => role.userId === customer["x-user-id"])!, id: "role-other", userId: "customer-other" });
    const response = await request(app.getHttpServer()).get(`/api/v1/orders/${order.body.data.orderId}`).set({ ...customer, "x-user-id": "customer-other" });
    expect(response.status).toBe(403);
  });

  it("rejects stale prices and suspended shops before creating an order", async () => {
    const body = await cart();
    store.listings[0].salePrice += 1000;
    const changed = await checkout(body, "price");
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("PRICE_CHANGED");
    const freshBody = await cart();
    store.shops.find((shop) => shop.id === store.listings[0].shopId)!.status = "SUSPENDED";
    const suspended = await checkout(freshBody, "shop");
    expect(suspended.status).toBe(409);
    expect(suspended.body.error.code).toBe("LISTING_UNAVAILABLE");
    expect(state.orders.size).toBe(0);
  });
});
