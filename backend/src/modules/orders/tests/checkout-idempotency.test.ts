import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CheckoutController } from "../api/checkout.controller";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  ordersErrorSchema,
} from "../api/contracts";
import {
  canonicalJson,
  CheckoutService,
  computeCheckoutRequestHash,
} from "../application/checkout.service";
import type { CurrentActor } from "../application/ports";
import {
  MockCheckoutExecutor,
  MockCurrentActor,
  MockIdempotencyStore,
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

const customerIdA = "99999999-9999-4999-8999-999999999999";
const customerIdB = "88888888-8888-4888-8888-888888888888";

interface HarnessOptions {
  readonly actor?: CurrentActor | null;
  readonly idempotencyStore?: MockIdempotencyStore;
}

function harness(options: HarnessOptions = {}) {
  const actor =
    options.actor !== undefined
      ? options.actor
      : {
          userId: customerIdA,
          activeRole: "CUSTOMER",
          activeProfileId: null,
        };
  const currentActor = new MockCurrentActor(actor);
  const idempotencyStore = options.idempotencyStore ?? new MockIdempotencyStore();
  const transaction = new MockTransaction();
  const { response: codResponse } = checkoutFixture("checkout-cod.json");
  const { response: onlineResponse } = checkoutFixture("checkout-online.json");

  const executor = new MockCheckoutExecutor(
    (context) =>
      context.request.paymentMethod === "ONLINE" ? onlineResponse : codResponse,
    idempotencyStore,
    transaction,
  );

  const service = new CheckoutService(currentActor, idempotencyStore, executor);
  const controller = new CheckoutController(service);

  return {
    currentActor,
    idempotencyStore,
    transaction,
    executor,
    service,
    controller,
    codResponse,
    onlineResponse,
  };
}

async function captureError(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error("Expected checkout operation to fail");
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

describe("Workflow 4 — Checkout request and idempotency", () => {
  it.each([undefined, null, "", "   "])(
    "rejects missing or blank Idempotency-Key with 400 INVALID_REQUEST (%s)",
    async (badKey) => {
      const { service } = harness();
      const { request } = checkoutFixture("checkout-cod.json");
      const { status, body } = await captureError(service.checkout(badKey, request));

      expect(status).toBe(400);
      expect(body.error).toMatchObject({
        code: "INVALID_REQUEST",
        details: [
          expect.objectContaining({
            field: "Idempotency-Key",
            code: "REQUIRED",
          }),
        ],
      });
    },
  );

  it.each([
    ["invalid cart UUID", { cartId: "not-a-uuid" }],
    ["missing phone", { shippingAddress: { phone: undefined } }],
    ["empty line1", { shippingAddress: { line1: "" } }],
    ["unsupported paymentMethod", { paymentMethod: "CRYPTO" }],
    ["unrecognized field", { extraField: "not-allowed" }],
  ])("rejects invalid request body with 400 INVALID_REQUEST: %s", async (_label, override) => {
    const { service } = harness();
    const { request } = checkoutFixture("checkout-cod.json");
    const badBody = {
      ...request,
      ...override,
      shippingAddress: {
        ...request.shippingAddress,
        ...((override as { shippingAddress?: Record<string, unknown> }).shippingAddress ?? {}),
      },
    };

    const { status, body } = await captureError(service.checkout("idem-key-1", badBody));
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
    const { service } = harness({ actor: null });
    const { request } = checkoutFixture("checkout-cod.json");
    const { status, body } = await captureError(service.checkout("idem-key-1", request));

    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    [
      "non-customer role",
      { userId: customerIdA, activeRole: "SELLER", activeProfileId: null },
    ],
    [
      "customer with active profile context",
      {
        userId: customerIdA,
        activeRole: "CUSTOMER",
        activeProfileId: "profile-123",
      },
    ],
  ])("rejects invalid actor with 403 FORBIDDEN: %s", async (_label, actor) => {
    const { service } = harness({ actor });
    const { request } = checkoutFixture("checkout-cod.json");
    const { status, body } = await captureError(service.checkout("idem-key-1", request));

    expect(status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("executes new checkout and stores idempotency record", async () => {
    const { service, executor, idempotencyStore, codResponse } = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    const result = await service.checkout("idem-key-1", request);

    expect(result).toEqual(codResponse);
    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]).toMatchObject({
      customerId: customerIdA,
      key: "idem-key-1",
      request,
    });

    const stored = await idempotencyStore.find(customerIdA, "idem-key-1");
    expect(stored).not.toBeNull();
    expect(stored?.response).toEqual(codResponse);
    expect(stored?.requestHash).toBe(computeCheckoutRequestHash(request));
  });

  it("replays stored response on duplicate request without re-executing", async () => {
    const { service, executor, codResponse } = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    const first = await service.checkout("idem-key-1", request);
    expect(first).toEqual(codResponse);
    expect(executor.calls).toHaveLength(1);

    // Second call with same key and body: replay
    const second = await service.checkout("idem-key-1", request);
    expect(second).toEqual(codResponse);
    expect(executor.calls).toHaveLength(1); // not called again
  });

  it("replays stored response even if the cart was cleared or modified afterwards", async () => {
    const { service, executor, idempotencyStore, codResponse } = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    // Pre-populate stored idempotency record simulating previously completed checkout
    await idempotencyStore.save(new MockTransaction().context, {
      customerId: customerIdA,
      key: "idem-key-pre-existing",
      requestHash: computeCheckoutRequestHash(request),
      response: codResponse,
    });

    // Replay happens BEFORE reading Cart: returns stored response immediately
    const result = await service.checkout("idem-key-pre-existing", request);
    expect(result).toEqual(codResponse);
    expect(executor.calls).toHaveLength(0);
  });

  it("rejects reusing the same key with different body with 409 IDEMPOTENCY_KEY_REUSED", async () => {
    const { service } = harness();
    const { request: codRequest } = checkoutFixture("checkout-cod.json");
    const { request: onlineRequest } = checkoutFixture("checkout-online.json");

    await service.checkout("idem-key-reuse", codRequest);

    // Same key, different paymentMethod
    const { status, body } = await captureError(
      service.checkout("idem-key-reuse", onlineRequest),
    );

    expect(status).toBe(409);
    expect(body.error).toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      details: [
        expect.objectContaining({
          field: "Idempotency-Key",
          code: "IDEMPOTENCY_KEY_REUSED",
        }),
      ],
    });
  });

  it("scopes idempotency keys per customer so Customers A and B do not collide", async () => {
    const idempotencyStore = new MockIdempotencyStore();
    const harnessA = harness({
      actor: { userId: customerIdA, activeRole: "CUSTOMER", activeProfileId: null },
      idempotencyStore,
    });
    const harnessB = harness({
      actor: { userId: customerIdB, activeRole: "CUSTOMER", activeProfileId: null },
      idempotencyStore,
    });

    const { request: requestA } = checkoutFixture("checkout-cod.json");
    const { request: requestB } = checkoutFixture("checkout-online.json");

    // Both customers submit with the exact same key "common-key"
    const resultA = await harnessA.service.checkout("common-key", requestA);
    const resultB = await harnessB.service.checkout("common-key", requestB);

    expect(resultA.paymentMethod).toBe("COD");
    expect(resultB.paymentMethod).toBe("ONLINE");
    expect(harnessA.executor.calls).toHaveLength(1);
    expect(harnessB.executor.calls).toHaveLength(1);

    // Customer A replays
    const replayA = await harnessA.service.checkout("common-key", requestA);
    expect(replayA.paymentMethod).toBe("COD");
    expect(harnessA.executor.calls).toHaveLength(1);

    // Customer B replays
    const replayB = await harnessB.service.checkout("common-key", requestB);
    expect(replayB.paymentMethod).toBe("ONLINE");
    expect(harnessB.executor.calls).toHaveLength(1);
  });

  it("recognizes canonical body with shuffled keys as identical payload", async () => {
    const { service, executor, codResponse } = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    await service.checkout("idem-key-canon", request);
    expect(executor.calls).toHaveLength(1);

    // Construct body with completely shuffled key order
    const shuffled = {
      paymentMethod: request.paymentMethod,
      shippingAddress: {
        provinceCode: request.shippingAddress.provinceCode,
        wardCode: request.shippingAddress.wardCode,
        line1: request.shippingAddress.line1,
        phone: request.shippingAddress.phone,
        recipientName: request.shippingAddress.recipientName,
      },
      cartId: request.cartId,
    };

    expect(computeCheckoutRequestHash(request)).toBe(
      computeCheckoutRequestHash(shuffled as unknown as typeof request),
    );
    expect(canonicalJson(request)).toBe(canonicalJson(shuffled));

    const replayed = await service.checkout("idem-key-canon", shuffled);
    expect(replayed).toEqual(codResponse);
    expect(executor.calls).toHaveLength(1); // recognized as replay
  });

  it("handles checkout through CheckoutController with Idempotency-Key header", async () => {
    const { controller, codResponse } = harness();
    const { request } = checkoutFixture("checkout-cod.json");

    // Test with standard lowercase Express header
    const result1 = await controller.checkout(
      { "idempotency-key": "controller-key-1" },
      request,
    );
    expect(result1).toEqual(codResponse);

    // Test replay through Controller with Pascal-case header
    const result2 = await controller.checkout(
      { "Idempotency-Key": "controller-key-1" },
      request,
    );
    expect(result2).toEqual(codResponse);
  });
});
