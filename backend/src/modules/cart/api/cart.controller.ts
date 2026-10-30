import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { UseGuards, Body, Controller, Delete, Get, Inject, Param, Post, Put } from "@nestjs/common";
import { CartService } from "../application/cart.service";
import type { CartView } from "./contracts";

@UseGuards(JwtAuthGuard)
@Controller("api/v1/cart")
export class CartController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @Get()
  getCart(): Promise<CartView> {
    return this.cartService.getCart();
  }

  @Post("items")
  postItem(
    @Body() body: { listingId: string; quantity?: number },
  ): Promise<CartView> {
    const listingId = body?.listingId;
    const quantity = body?.quantity ?? 1;
    return this.cartService.putItem(listingId, { quantity });
  }

  @Put("items/:listingId")
  putItem(
    @Param("listingId") listingId: string,
    @Body() body: unknown,
  ): Promise<CartView> {
    return this.cartService.putItem(listingId, body);
  }

  @Delete("items/:listingId")
  deleteItem(@Param("listingId") listingId: string): Promise<CartView> {
    return this.cartService.deleteItem(listingId);
  }
}
