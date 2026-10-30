import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { UseGuards, Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { OrderQueryService } from "../application/order-query.service";
import type {
  CustomerOrderDetailResponse,
  CustomerOrderListResponse,
} from "./contracts";

@UseGuards(JwtAuthGuard)
@Controller("api/v1/orders")
export class OrdersController {
  constructor(@Inject(OrderQueryService) private readonly orderQueryService: OrderQueryService) {}

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
