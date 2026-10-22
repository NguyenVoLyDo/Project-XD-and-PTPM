import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  customerOrderDetailSchema,
  customerOrderListResponseSchema,
  ordersErrorSchema,
  type CustomerOrderDetailResponse,
  type CustomerOrderListResponse,
} from "../api/contracts";
import { OrdersController } from "../api/orders.controller";
import { OrderQueryService } from "../application/order-query.service";
import type { CurrentActor } from "../application/ports";
import type {
  CustomerOrder,
  FulfillmentOrderSnapshot,
  OrderAggregate,
  OrderItem,
} from "../domain/order";
import {
  MockCurrentActor,
  MockOrderRepository,
} from "../infrastructure/mocks";

function readFixture<T = unknown>(name: string): T {
  return JSON.parse(
    readFileSync(join(__dirname, "fixtures", name), "utf8"),
  ) as T;
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

function createSampleAggregate(overrides?: {
  order?: Partial<CustomerOrder>;
  items?: OrderItem[];
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

  const defaultItems: OrderItem[] = [
    {
      orderItemId: "99999999-9999-4999-8999-999999999999",
      customerOrderId: orderId,
      fulfillmentOrderId: "44444444-4444-4444-8444-444444444444",
      lineIndex: 0,
      listingId: "88888888-8888-4888-8888-888888888888",
      productId: "77777777-7777-4777-8777-777777777777",
      supplierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sellerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      productName: "Sản phẩm A",
      listingTitle: "Listing của Seller 1",
      quantity: 1,
      unitSalePrice: 150000,
      unitCostPrice: 100000,
      lineSaleTotal: 150000,
      lineCostTotal: 100000,
      reservationId: "aaaaaaaa-1111-4111-8111-111111111111",
      currency: "VND",
    },
    {
      orderItemId: "99999999-9999-4999-8999-999999999998",
      customerOrderId: orderId,
      fulfillmentOrderId: "55555555-5555-4555-8555-555555555555",
      lineIndex: 1,
      listingId: "88888888-8888-4888-8888-888888888889",
      productId: "77777777-7777-4777-8777-777777777777",
      supplierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sellerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      productName: "Sản phẩm A",
      listingTitle: "Listing của Seller 2",
      quantity: 1,
      unitSalePrice: 150000,
      unitCostPrice: 100000,
      lineSaleTotal: 150000,
      lineCostTotal: 100000,
      reservationId: "aaaaaaaa-1111-4111-8111-111111111112",
      currency: "VND",
    },
  ];

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
    items: overrides?.items ?? defaultItems,
    fulfillmentOrders:
      overrides?.fulfillmentOrders ?? defaultFulfillmentOrders,
  };
}

function harness(
  actor: CurrentActor | null = {
    userId: "11111111-1111-4111-8111-111111111111",
    activeRole: "CUSTOMER",
    activeProfileId: null,
  },
  initialAggregates: OrderAggregate[] = [],
) {
  const currentActor = new MockCurrentActor(actor);
  const orderRepository = new MockOrderRepository();

  for (const agg of initialAggregates) {
    orderRepository.orders.set(agg.order.orderId, agg);
  }

  const queryService = new OrderQueryService(currentActor, orderRepository);
  const controller = new OrdersController(queryService);

  return {
    currentActor,
    orderRepository,
    queryService,
    controller,
  };
}

describe("Workflow 7 — Customer xem Order", () => {
  describe("Fixture validation", () => {
    it("validates order-detail.json matches customerOrderDetailSchema", () => {
      const fixture = readFixture<CustomerOrderDetailResponse>(
        "order-detail.json",
      );
      const parsed = customerOrderDetailSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
      expect(parsed.items).toHaveLength(2);
      expect(parsed.fulfillmentOrders).toHaveLength(2);
      expect(parsed.totalPayable).toBe(300000);
    });

    it("validates order-list.json matches customerOrderListResponseSchema", () => {
      const fixture = readFixture<CustomerOrderListResponse>("order-list.json");
      const parsed = customerOrderListResponseSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.pagination.total).toBe(1);
    });
  });

  describe("Quyền sở hữu và bảo mật (401, 403, 404)", () => {
    it("returns 401 UNAUTHORIZED when actor is not authenticated", async () => {
      const h = harness(null);

      const errList = await captureError(h.controller.listOrders());
      expect(errList.status).toBe(401);
      expect(errList.body.error.code).toBe("UNAUTHORIZED");

      const errDetail = await captureError(
        h.controller.getOrderDetail("33333333-3333-4333-8333-333333333333"),
      );
      expect(errDetail.status).toBe(401);
      expect(errDetail.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 FORBIDDEN when actor has active Supplier or Seller role", async () => {
      const supplierActor: CurrentActor = {
        userId: "supplier-user-1",
        activeRole: "SUPPLIER",
        activeProfileId: "supplier-profile-1",
      };
      const h = harness(supplierActor);

      const errList = await captureError(h.controller.listOrders());
      expect(errList.status).toBe(403);
      expect(errList.body.error.code).toBe("FORBIDDEN");

      const errDetail = await captureError(
        h.controller.getOrderDetail("33333333-3333-4333-8333-333333333333"),
      );
      expect(errDetail.status).toBe(403);
      expect(errDetail.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 FORBIDDEN when Customer B attempts to view Customer A's order (no PII leak)", async () => {
      const aggregateA = createSampleAggregate(); // Owned by 11111111-1111-4111-8111-111111111111
      const customerB: CurrentActor = {
        userId: "22222222-2222-4222-8222-222222222222",
        activeRole: "CUSTOMER",
        activeProfileId: null,
      };

      const h = harness(customerB, [aggregateA]);

      const err = await captureError(
        h.controller.getOrderDetail(aggregateA.order.orderId),
      );
      expect(err.status).toBe(403);
      expect(err.body.error.code).toBe("FORBIDDEN");
      expect(err.body.error.message).toBe("Không có quyền truy cập đơn hàng");
      // Must not leak order details or PII
      expect(err.body.error.details).toHaveLength(0);
    });

    it("returns 404 ORDER_NOT_FOUND when order does not exist", async () => {
      const h = harness();

      const err = await captureError(
        h.controller.getOrderDetail("99999999-9999-4999-8999-999999999999"),
      );
      expect(err.status).toBe(404);
      expect(err.body.error.code).toBe("ORDER_NOT_FOUND");
    });

    it("returns 400 INVALID_REQUEST when orderId is not a valid UUID", async () => {
      const h = harness();

      const err = await captureError(
        h.controller.getOrderDetail("not-a-uuid"),
      );
      expect(err.status).toBe(400);
      expect(err.body.error.code).toBe("INVALID_REQUEST");
      expect(err.body.error.details[0]?.code).toBe("INVALID_UUID");
    });
  });

  describe("Tính bất biến của lịch sử (Historical Snapshot Invariance)", () => {
    it("returns exact snapshot prices and names even if Listings change price or title later", async () => {
      const initial = createSampleAggregate();
      const h = harness(undefined, [initial]);

      const detail = await h.controller.getOrderDetail(initial.order.orderId);

      // Verify strict snapshot preservation
      expect(detail.items[0].unitSalePrice).toBe(150000);
      expect(detail.items[0].productName).toBe("Sản phẩm A");
      expect(detail.items[0].listingTitle).toBe("Listing của Seller 1");

      // Verify that no internal cost price is exposed to Customer
      expect((detail.items[0] as any).unitCostPrice).toBeUndefined();
      expect((detail.items[0] as any).lineCostTotal).toBeUndefined();
    });
  });

  describe("Tính nhất quán của tổng tiền (Allocation Totals)", () => {
    it("ensures totalPayable strictly matches the sum of amountToCollect across fulfillment orders", async () => {
      const initial = createSampleAggregate();
      const h = harness(undefined, [initial]);

      const detail = await h.controller.getOrderDetail(initial.order.orderId);

      const allocationSum = detail.fulfillmentOrders.reduce(
        (sum, fo) => sum + fo.amountToCollect,
        0,
      );
      expect(detail.totalPayable).toBe(allocationSum);
      expect(detail.grandTotal).toBe(300000);
    });
  });

  describe("Danh sách phân trang (GET /api/v1/orders)", () => {
    it("lists orders paginated and scoped to current customer", async () => {
      const customerId = "11111111-1111-4111-8111-111111111111";
      const otherCustomerId = "22222222-2222-4222-8222-222222222222";

      const orders: OrderAggregate[] = [];
      for (let i = 1; i <= 5; i++) {
        orders.push(
          createSampleAggregate({
            order: {
              orderId: `33333333-3333-4333-8333-33333333330${i}`,
              orderNo: `DC-ORDER-00${i}`,
              customerId,
              createdAt: `2026-10-0${i}T10:00:00Z`,
            },
          }),
        );
      }

      // Order of another customer (must not appear)
      orders.push(
        createSampleAggregate({
          order: {
            orderId: "44444444-4444-4444-8444-444444444444",
            orderNo: "DC-OTHER-001",
            customerId: otherCustomerId,
            createdAt: "2026-10-10T10:00:00Z",
          },
        }),
      );

      const h = harness(
        { userId: customerId, activeRole: "CUSTOMER", activeProfileId: null },
        orders,
      );

      // Page 1 with limit 2 (sorted newest first)
      const page1 = await h.controller.listOrders("1", "2");
      expect(customerOrderListResponseSchema.parse(page1)).toEqual(page1);
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
      expect(page1.items[0].orderNo).toBe("DC-ORDER-005");
      expect(page1.items[1].orderNo).toBe("DC-ORDER-004");

      // Page 2
      const page2 = await h.controller.listOrders("2", "2");
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0].orderNo).toBe("DC-ORDER-003");
      expect(page2.items[1].orderNo).toBe("DC-ORDER-002");

      // Page 3
      const page3 = await h.controller.listOrders("3", "2");
      expect(page3.items).toHaveLength(1);
      expect(page3.items[0].orderNo).toBe("DC-ORDER-001");
    });
  });
});
