import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { UseGuards, Body, Controller, Headers, Inject, Post } from "@nestjs/common";
import { CheckoutService } from "../application/checkout.service";
import type { CheckoutResponse } from "./contracts";

@UseGuards(JwtAuthGuard)
@Controller(["api/v1/checkout", "api/v1/orders/checkout"])
export class CheckoutController {
  constructor(@Inject(CheckoutService) private readonly checkoutService: CheckoutService) {}

  @Post()
  checkout(
    @Headers() headers: Record<string, string | undefined> = {},
    @Body() body: unknown,
  ): Promise<CheckoutResponse> {
    const key =
      headers["idempotency-key"] ??
      headers["Idempotency-Key"] ??
      headers["IDEMPOTENCY-KEY"];
    return this.checkoutService.checkout(key, body);
  }
}
