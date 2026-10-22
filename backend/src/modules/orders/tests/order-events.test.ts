import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CustomerOrder,
  DomainEventEnvelope,
  FulfillmentOrderSnapshot,
  OrderAggregate,
} from "../domain/order";
import { computeFulfillmentSummary } from "../domain/fulfillment-projection";
import { OrderEventConsumerService } from "../application/order-event-consumer.service";
import {
  MockOrderRepository,
  MockOutbox,
  MockProcessedEvents,
  MockTransaction,
} from "../infrastructure/mocks";
import { CheckoutController } from "../api/checkout.controller";

function readFixture<T = unknown>(name: string): T {
  return JSON.parse(
    readFileSync(join(__dirname, "fixtures", name), "utf8"),
  ) as T;
}

function createSampleAggregate(overrides?: {
  order?: Partial<CustomerOrder>;
  fulfillmentOrders?: FulfillmentOrderSnapshot[];
}): OrderAggregate {
  const orderId = "33333333-3333-4333-8333-333333333333";
  const customerId = "11111111-1111-4111-8111-111111111111";

  const defaultOrder: CustomerOrder = {
    orderId,
    orderNo: "DC-EXAMPLE-001",
    customerId,
    status: "CONFIRMED",
    fulfillmentSummary: "UNFULFILLED",
    paymentMethod: "COD",
    paymentStatus: "PENDING_COD",
    currency: "VND",
    grandTotal: 300000,
    totalPayable: 300000,
    shippingAddress: {
      recipientName: "Khách mẫu",
      phone: "0900000000",
      line1: "Địa chỉ mẫu",
      wardCode: "00001",
      provinceCode: "01",
    },
    createdAt: "2026-10-01T10:00:00Z",
  };

  const defaultFulfillmentOrders: FulfillmentOrderSnapshot[] = [
    {
      fulfillmentOrderId: "44444444-4444-4444-8444-444444444444",
      customerOrderId: orderId,
      supplierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sellerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "PENDING_ACCEPTANCE",
      amountToCollect: 150000,
      paymentAllocationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      orderItemIds: ["99999999-9999-4999-8999-999999999999"],
    },
    {
      fulfillmentOrderId: "55555555-5555-4555-8555-555555555555",
      customerOrderId: orderId,
      supplierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sellerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "PENDING_ACCEPTANCE",
      amountToCollect: 150000,
      paymentAllocationId: "ffffffff-ffff-4fff-8fff-fffffffffffe",
      orderItemIds: ["99999999-9999-4999-8999-999999999998"],
    },
  ];

  return {
    order: { ...defaultOrder, ...overrides?.order },
    items: [],
    fulfillmentOrders:
      overrides?.fulfillmentOrders ?? defaultFulfillmentOrders,
  };
}

function harness(initialAggregate?: OrderAggregate) {
  const transaction = new MockTransaction();
  const orderRepository = new MockOrderRepository();
  const outbox = new MockOutbox();
  const processedEvents = new MockProcessedEvents();

  if (initialAggregate) {
    orderRepository.orders.set(initialAggregate.order.orderId, initialAggregate);
  }

  const consumer = new OrderEventConsumerService(
    transaction,
    orderRepository,
    outbox,
    processedEvents,
  );

  return {
    transaction,
    orderRepository,
    outbox,
    processedEvents,
    consumer,
  };
}

describe("Workflow 6 — Nhận kết quả payment/fulfillment", () => {
  describe("Fixture validation", () => {
    it.each([
      "payment-succeeded.json",
      "payment-failed.json",
      "payment-timed-out.json",
      "fulfillment-accepted.json",
      "fulfillment-rejected.json",
      "fulfillment-timed-out.json",
      "fulfillment-shipped.json",
      "fulfillment-delivered.json",
    ])("parses fixture %s with valid envelope structure", (fixtureName) => {
      const event = readFixture<DomainEventEnvelope>(fixtureName);
      expect(event.eventId).toBeTruthy();
      expect(event.eventType).toBeTruthy();
      expect(event.eventVersion).toBe(1);
      expect(event.aggregateId).toBeTruthy();
      expect(event.occurredAt).toBeTruthy();
      expect(event.correlationId).toBeTruthy();
      expect(event.payload).toBeDefined();
    });
  });

  describe("Criterion 1: Callback / Event trùng không chuyển trạng thái hai lần (Deduplication)", () => {
    it("processes PaymentSucceeded once, and safely ignores duplicate delivery", async () => {
      const initial = createSampleAggregate({
        order: {
          paymentMethod: "ONLINE",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          paymentIntentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        },
      });
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("payment-succeeded.json");

      // First delivery
      const res1 = await h.consumer.consume(event);
      expect(res1.status).toBe("PROCESSED");
      expect(res1.order?.status).toBe("CONFIRMED");
      expect(res1.order?.paymentStatus).toBe("PAID");

      // Verify OrderConfirmed event emitted to outbox
      expect(h.outbox.events).toHaveLength(1);
      expect(h.outbox.events[0]).toMatchObject({
        eventType: "OrderConfirmed",
        aggregateId: initial.order.orderId,
        payload: {
          orderId: initial.order.orderId,
          fulfillmentOrderIds: initial.fulfillmentOrders.map((f) => f.fulfillmentOrderId),
        },
      });

      // Second delivery (duplicate event)
      const res2 = await h.consumer.consume(event);
      expect(res2.status).toBe("IGNORED_DUPLICATE");
      expect(res2.order?.status).toBe("CONFIRMED");

      // Outbox must NOT have emitted a second OrderConfirmed event
      expect(h.outbox.events).toHaveLength(1);

      // Verify aggregate status in repository
      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.status).toBe("CONFIRMED");
      expect(saved?.order.paymentStatus).toBe("PAID");
    });

    it("safely ignores duplicate FulfillmentRejected and does not double-deduct amounts", async () => {
      const initial = createSampleAggregate();
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("fulfillment-rejected.json");

      // First delivery
      const res1 = await h.consumer.consume(event);
      expect(res1.status).toBe("PROCESSED");
      expect(res1.order?.fulfillmentSummary).toBe("PARTIALLY_CANCELED");
      expect(res1.order?.totalPayable).toBe(150000);

      // Second delivery (duplicate event)
      const res2 = await h.consumer.consume(event);
      expect(res2.status).toBe("IGNORED_DUPLICATE");

      // Total payable must remain 150000, not double-deducted to 0
      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.totalPayable).toBe(150000);
      expect(saved?.order.grandTotal).toBe(300000);
    });

    it("safely ignores duplicate PaymentTimedOut events", async () => {
      const initial = createSampleAggregate({
        order: {
          paymentMethod: "ONLINE",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
        },
      });
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("payment-timed-out.json");

      const res1 = await h.consumer.consume(event);
      expect(res1.status).toBe("PROCESSED");
      expect(res1.order?.status).toBe("CANCELED");

      const res2 = await h.consumer.consume(event);
      expect(res2.status).toBe("IGNORED_DUPLICATE");

      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.status).toBe("CANCELED");
    });
  });

  describe("Criterion 2: Một đơn con bị từ chối dẫn đến PARTIALLY_CANCELED nhưng đơn con khác giữ nguyên", () => {
    it("handles single sub-order rejection with reasonCode and sourceRef, keeping sibling sub-order active", async () => {
      const initial = createSampleAggregate();
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("fulfillment-rejected.json");

      const res = await h.consumer.consume(event);
      expect(res.status).toBe("PROCESSED");

      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved).not.toBeNull();

      // Rejected FO (FO-1)
      const fo1 = saved?.fulfillmentOrders.find(
        (f) => f.fulfillmentOrderId === "44444444-4444-4444-8444-444444444444",
      );
      expect(fo1?.status).toBe("REJECTED");
      expect(fo1?.reasonCode).toBe("OUT_OF_STOCK");
      expect(fo1?.sourceRef).toBe("supplier-reject-001");

      // Untouched FO (FO-2)
      const fo2 = saved?.fulfillmentOrders.find(
        (f) => f.fulfillmentOrderId === "55555555-5555-4555-8555-555555555555",
      );
      expect(fo2?.status).toBe("PENDING_ACCEPTANCE");
      expect(fo2?.reasonCode).toBeUndefined();

      // CustomerOrder projection
      expect(saved?.order.fulfillmentSummary).toBe("PARTIALLY_CANCELED");
      expect(saved?.order.status).toBe("CONFIRMED"); // Parent order not canceled because FO-2 is still active
      expect(saved?.order.grandTotal).toBe(300000); // Grand total is immutable
      expect(saved?.order.totalPayable).toBe(150000); // Payable reduced by FO-1 allocation
    });

    it("transitions CustomerOrder to CANCELED and VOIDED when ALL sub-orders are rejected", async () => {
      const initial = createSampleAggregate();
      const h = harness(initial);

      // 1. Reject first sub-order
      await h.consumer.consume(
        readFixture<DomainEventEnvelope>("fulfillment-rejected.json"),
      );

      // 2. Reject second sub-order
      const rejectSecondEvent: DomainEventEnvelope = {
        eventId: "22222222-2222-4222-8222-222222222222",
        eventType: "FulfillmentRejected",
        eventVersion: 1,
        aggregateId: "55555555-5555-4555-8555-555555555555",
        occurredAt: "2026-10-01T11:10:00Z",
        correlationId: "cccccccc-2222-4222-8222-222222222222",
        payload: {
          orderId: initial.order.orderId,
          fulfillmentOrderId: "55555555-5555-4555-8555-555555555555",
          reasonCode: "SELLER_REJECTED",
          sourceRef: "seller-reject-002",
        },
      };

      const res = await h.consumer.consume(rejectSecondEvent);
      expect(res.status).toBe("PROCESSED");

      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.fulfillmentSummary).toBe("CANCELED");
      expect(saved?.order.status).toBe("CANCELED");
      expect(saved?.order.paymentStatus).toBe("VOIDED");
      expect(saved?.order.totalPayable).toBe(0);
      expect(saved?.order.grandTotal).toBe(300000);
    });

    it("handles supplier timeout (24h) via FulfillmentTimedOut", async () => {
      const initial = createSampleAggregate();
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("fulfillment-timed-out.json");

      const res = await h.consumer.consume(event);
      expect(res.status).toBe("PROCESSED");

      const saved = await h.orderRepository.findById(initial.order.orderId);
      const timedOutFo = saved?.fulfillmentOrders.find(
        (f) => f.fulfillmentOrderId === "44444444-4444-4444-8444-444444444444",
      );
      expect(timedOutFo?.status).toBe("CANCELED");
      expect(timedOutFo?.reasonCode).toBe("SUPPLIER_TIMEOUT");
      expect(timedOutFo?.sourceRef).toBe("fulfillment-job-timeout-001");

      expect(saved?.order.fulfillmentSummary).toBe("PARTIALLY_CANCELED");
      expect(saved?.order.totalPayable).toBe(150000);
    });
  });

  describe("Criterion 3: Online timeout và COD đi đúng trạng thái", () => {
    it("handles Online timeout by canceling the order and all pending sub-orders", async () => {
      const initial = createSampleAggregate({
        order: {
          paymentMethod: "ONLINE",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
        },
      });
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("payment-timed-out.json");

      const res = await h.consumer.consume(event);
      expect(res.status).toBe("PROCESSED");
      expect(res.order?.status).toBe("CANCELED");
      expect(res.order?.paymentStatus).toBe("FAILED");
      expect(res.order?.fulfillmentSummary).toBe("CANCELED");
      expect(res.order?.totalPayable).toBe(0);

      const saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.fulfillmentOrders.every((f) => f.status === "CANCELED")).toBe(
        true,
      );
      expect(
        saved?.fulfillmentOrders.every(
          (f) => f.reasonCode === "ONLINE_PAYMENT_EXPIRED",
        ),
      ).toBe(true);
    });

    it("handles Online payment failure", async () => {
      const initial = createSampleAggregate({
        order: {
          paymentMethod: "ONLINE",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
        },
      });
      const h = harness(initial);
      const event = readFixture<DomainEventEnvelope>("payment-failed.json");

      const res = await h.consumer.consume(event);
      expect(res.status).toBe("PROCESSED");
      expect(res.order?.status).toBe("PAYMENT_FAILED");
      expect(res.order?.paymentStatus).toBe("FAILED");
    });

    it("tracks full lifecycle of COD order (acceptance, shipping, delivery, and collection)", async () => {
      const initial = createSampleAggregate();
      const h = harness(initial);

      // 1. Initial COD state
      expect(initial.order.status).toBe("CONFIRMED");
      expect(initial.order.paymentStatus).toBe("PENDING_COD");
      expect(initial.order.fulfillmentSummary).toBe("UNFULFILLED");

      // 2. Supplier accepts FO-2
      await h.consumer.consume(
        readFixture<DomainEventEnvelope>("fulfillment-accepted.json"),
      );
      let saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.status).toBe("PROCESSING");
      expect(saved?.order.fulfillmentSummary).toBe("UNFULFILLED");

      // 3. FO-2 shipped by carrier
      await h.consumer.consume(
        readFixture<DomainEventEnvelope>("fulfillment-shipped.json"),
      );
      saved = await h.orderRepository.findById(initial.order.orderId);
      const fo2Shipped = saved?.fulfillmentOrders.find(
        (f) => f.fulfillmentOrderId === "55555555-5555-4555-8555-555555555555",
      );
      expect(fo2Shipped?.status).toBe("SHIPPED");
      expect(fo2Shipped?.trackingNo).toBe("GHN-SAMPLE-123456");
      expect(fo2Shipped?.carrierCode).toBe("GHN");

      // 4. FO-2 delivered
      await h.consumer.consume(
        readFixture<DomainEventEnvelope>("fulfillment-delivered.json"),
      );
      saved = await h.orderRepository.findById(initial.order.orderId);
      // One delivered, one still pending acceptance -> PARTIALLY_FULFILLED
      expect(saved?.order.fulfillmentSummary).toBe("PARTIALLY_FULFILLED");

      // 5. Accept and deliver FO-1 as well
      await h.consumer.consume({
        eventId: "33333333-1111-4111-8111-111111111111",
        eventType: "FulfillmentDelivered",
        eventVersion: 1,
        aggregateId: "44444444-4444-4444-8444-444444444444",
        occurredAt: "2026-10-02T18:00:00Z",
        correlationId: "cccccccc-3333-4333-8333-333333333333",
        payload: {
          orderId: initial.order.orderId,
          fulfillmentOrderId: "44444444-4444-4444-8444-444444444444",
        },
      });

      saved = await h.orderRepository.findById(initial.order.orderId);
      // Both delivered -> FULFILLED
      expect(saved?.order.fulfillmentSummary).toBe("FULFILLED");

      // 6. Carrier collects COD payment
      await h.consumer.consume({
        eventId: "33333333-2222-4222-8222-222222222222",
        eventType: "PaymentCollected",
        eventVersion: 1,
        aggregateId: initial.order.orderId,
        occurredAt: "2026-10-02T18:30:00Z",
        correlationId: "cccccccc-4444-4444-8444-444444444444",
        payload: {
          orderId: initial.order.orderId,
          amountCollected: 300000,
        },
      });

      saved = await h.orderRepository.findById(initial.order.orderId);
      expect(saved?.order.paymentStatus).toBe("COLLECTED");
    });
  });

  describe("Criterion 4: Không có API sửa summary trực tiếp", () => {
    it("confirms CheckoutController does not expose any direct summary modification endpoint", () => {
      const prototype = CheckoutController.prototype;
      const methods = Object.getOwnPropertyNames(prototype).filter(
        (prop) => prop !== "constructor",
      );

      // Only checkout endpoint should be present in checkout controller
      expect(methods).toEqual(["checkout"]);

      // Verify no direct summary setters exist
      expect(methods).not.toContain("updateSummary");
      expect(methods).not.toContain("setFulfillmentSummary");
      expect(methods).not.toContain("patchSummary");
    });

    it("verifies computeFulfillmentSummary is a pure projection reflecting domain state machine", () => {
      // Empty
      expect(computeFulfillmentSummary([])).toBe("UNFULFILLED");

      // All pending
      expect(
        computeFulfillmentSummary([
          { status: "PENDING_ACCEPTANCE" } as any,
          { status: "PENDING_ACCEPTANCE" } as any,
        ]),
      ).toBe("UNFULFILLED");

      // Partial rejection
      expect(
        computeFulfillmentSummary([
          { status: "REJECTED" } as any,
          { status: "ACCEPTED" } as any,
        ]),
      ).toBe("PARTIALLY_CANCELED");

      // All canceled
      expect(
        computeFulfillmentSummary([
          { status: "REJECTED" } as any,
          { status: "CANCELED" } as any,
        ]),
      ).toBe("CANCELED");

      // Partial fulfillment
      expect(
        computeFulfillmentSummary([
          { status: "DELIVERED" } as any,
          { status: "SHIPPED" } as any,
        ]),
      ).toBe("PARTIALLY_FULFILLED");

      // Partial completed (delivered + canceled/refunded)
      expect(
        computeFulfillmentSummary([
          { status: "DELIVERED" } as any,
          { status: "REJECTED" } as any,
        ]),
      ).toBe("PARTIALLY_COMPLETED");

      // All fulfilled
      expect(
        computeFulfillmentSummary([
          { status: "DELIVERED" } as any,
          { status: "DELIVERED" } as any,
        ]),
      ).toBe("FULFILLED");

      // Return requested
      expect(
        computeFulfillmentSummary([
          { status: "DELIVERED" } as any,
          { status: "RETURN_REQUESTED" } as any,
        ]),
      ).toBe("RETURN_IN_PROGRESS");
    });
  });
});
