import { Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import { CartService } from "../application/cart.service";
import type { CartView } from "./contracts";

@Controller("api/v1/cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(): Promise<CartView> {
    return this.cartService.getCart();
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
