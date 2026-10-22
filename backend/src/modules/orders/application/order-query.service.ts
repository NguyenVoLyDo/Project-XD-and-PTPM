import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type {
  CustomerOrderDetailResponse,
  CustomerOrderListResponse,
} from "../api/contracts";
import { failOrders } from "./errors";
import {
  ORDERS_CURRENT_ACTOR,
  ORDERS_ORDER_REPOSITORY,
  type CurrentActorPort,
  type OrderRepositoryPort,
} from "./ports";

const uuidSchema = z.string().uuid();

export interface OrderListQuery {
  readonly page?: string | number;
  readonly limit?: string | number;
}

@Injectable()
export class OrderQueryService {
  constructor(
    @Inject(ORDERS_CURRENT_ACTOR)
    private readonly currentActor: CurrentActorPort,
    @Inject(ORDERS_ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async listOrders(query?: OrderListQuery): Promise<CustomerOrderListResponse> {
    const customerId = await this.requireCustomerId();

    let page = 1;
    let limit = 20;

    if (query?.page !== undefined) {
      const parsedPage = Number(query.page);
      if (Number.isInteger(parsedPage) && parsedPage > 0) {
        page = parsedPage;
      }
    }

    if (query?.limit !== undefined) {
      const parsedLimit = Number(query.limit);
      if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(100, parsedLimit);
      }
    }

    const result = await this.orderRepository.findByCustomerId(customerId, {
      page,
      limit,
    });

    return {
      items: result.items.map((aggregate) => ({
        orderId: aggregate.order.orderId,
        orderNo: aggregate.order.orderNo,
        status: aggregate.order.status,
        fulfillmentSummary: aggregate.order.fulfillmentSummary,
        paymentMethod: aggregate.order.paymentMethod,
        paymentStatus: aggregate.order.paymentStatus,
        currency: aggregate.order.currency,
        grandTotal: aggregate.order.grandTotal,
        totalPayable: aggregate.order.totalPayable,
        itemCount: aggregate.items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        createdAt: aggregate.order.createdAt,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getOrderDetail(
    orderIdRaw: string,
  ): Promise<CustomerOrderDetailResponse> {
    const customerId = await this.requireCustomerId();

    const parsedOrderId = uuidSchema.safeParse(orderIdRaw);
    if (!parsedOrderId.success) {
      failOrders(400, "INVALID_REQUEST", "Mã đơn hàng không hợp lệ", [
        { field: "orderId", code: "INVALID_UUID" },
      ]);
    }
    const orderId = parsedOrderId.data;

    const aggregate = await this.orderRepository.findById(orderId);
    if (!aggregate) {
      failOrders(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng", []);
    }

    // Ownership check per Common contract and NFR-01:
    // If resource exists but does not belong to Current Customer, return 403 FORBIDDEN without revealing resource details
    if (aggregate.order.customerId !== customerId) {
      failOrders(403, "FORBIDDEN", "Không có quyền truy cập đơn hàng", []);
    }

    const { order, items, fulfillmentOrders } = aggregate;

    return {
      orderId: order.orderId,
      orderNo: order.orderNo,
      status: order.status,
      fulfillmentSummary: order.fulfillmentSummary,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      grandTotal: order.grandTotal,
      totalPayable: order.totalPayable,
      shippingAddress: order.shippingAddress,
      paymentIntentId: order.paymentIntentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: items.map((item) => ({
        orderItemId: item.orderItemId,
        fulfillmentOrderId: item.fulfillmentOrderId,
        lineIndex: item.lineIndex,
        listingId: item.listingId,
        productId: item.productId,
        productName: item.productName,
        listingTitle: item.listingTitle,
        quantity: item.quantity,
        unitSalePrice: item.unitSalePrice,
        lineSaleTotal: item.lineSaleTotal,
        currency: item.currency,
      })),
      fulfillmentOrders: fulfillmentOrders.map((fo) => ({
        fulfillmentOrderId: fo.fulfillmentOrderId,
        supplierId: fo.supplierId,
        sellerId: fo.sellerId,
        status: fo.status,
        amountToCollect: fo.amountToCollect,
        trackingNo: fo.trackingNo,
        carrierCode: fo.carrierCode,
      })),
    };
  }

  private async requireCustomerId(): Promise<string> {
    const actor = await this.currentActor.getCurrentActor();
    if (!actor) {
      failOrders(401, "UNAUTHORIZED", "Vui lòng đăng nhập", []);
    }
    if (actor.activeRole !== "CUSTOMER" || actor.activeProfileId !== null) {
      failOrders(
        403,
        "FORBIDDEN",
        "Chỉ Customer được truy cập danh sách và chi tiết đơn hàng",
        [],
      );
    }
    return actor.userId;
  }
}
