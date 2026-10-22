import { Body, Controller, Headers, Post } from "@nestjs/common";
import { CheckoutService } from "../application/checkout.service";
import type { CheckoutResponse } from "./contracts";

@Controller("api/v1/checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

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
