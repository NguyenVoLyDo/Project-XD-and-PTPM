import { Controller, Get, Param, Query } from "@nestjs/common";
import { OrderQueryService } from "../application/order-query.service";
import type {
  CustomerOrderDetailResponse,
  CustomerOrderListResponse,
} from "./contracts";

@Controller("api/v1/orders")
export class OrdersController {
  constructor(private readonly orderQueryService: OrderQueryService) {}

  @Get()
  listOrders(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<CustomerOrderListResponse> {
    return this.orderQueryService.listOrders({ page, limit });
  }

  @Get(":orderId")
  getOrderDetail(
    @Param("orderId") orderId: string,
  ): Promise<CustomerOrderDetailResponse> {
    return this.orderQueryService.getOrderDetail(orderId);
  }
}
