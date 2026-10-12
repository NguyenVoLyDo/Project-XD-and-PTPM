import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  cartViewSchema,
  putCartItemBodySchema,
  type CartView,
} from "../api/contracts";
import type { CartItem, CartSnapshot } from "../domain/cart";
import {
  CART_CURRENT_ACTOR,
  CART_LISTING_PROJECTION,
  CART_STORE,
  type CartListingProjectionPort,
  type CartStorePort,
  type CurrentActorPort,
  type ListingProjection,
} from "./ports";

const listingIdSchema = z.uuid();

interface CartErrorDetail {
  readonly field?: string;
  readonly code?: string;
  readonly message?: string;
}

function fail(
  status: number,
  code: string,
  message: string,
  details: readonly CartErrorDetail[] = [],
): never {
  throw new HttpException(
    { error: { code, message, details } },
    status,
  );
}

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_CURRENT_ACTOR)
    private readonly currentActor: CurrentActorPort,
    @Inject(CART_STORE) private readonly carts: CartStorePort,
    @Inject(CART_LISTING_PROJECTION)
    private readonly listings: CartListingProjectionPort,
  ) {}

  async getCart(): Promise<CartView> {
    const customerId = await this.requireCustomerId();
    const cart = await this.getOrCreateCart(customerId);
    return this.render(cart, false);
  }

  async putItem(listingId: string, body: unknown): Promise<CartView> {
    const customerId = await this.requireCustomerId();
    this.requireListingId(listingId);
    const quantity = this.parseQuantity(body);
    const listing = await this.getListing(listingId);

    if (listing.availability === "UNAVAILABLE") {
      const code = listing.unavailableCode ?? "LISTING_UNAVAILABLE";
      fail(
        409,
        code,
        code === "LISTING_PAUSED_BY_POLICY"
          ? "Listing tạm ngưng theo chính sách"
          : "Listing hiện không khả dụng",
        [{ field: "listingId", code }],
      );
    }

    const cart = await this.getOrCreateCart(customerId);
    const items = cart.items.some((item) => item.listingId === listingId)
      ? cart.items.map((item) =>
          item.listingId === listingId ? { ...item, quantity } : item,
        )
      : [...cart.items, { listingId, quantity }];

    return this.render({ ...cart, items }, true);
  }

  async deleteItem(listingId: string): Promise<CartView> {
    const customerId = await this.requireCustomerId();
    this.requireListingId(listingId);
    const cart = await this.getOrCreateCart(customerId);
    const updated: CartSnapshot = {
      ...cart,
      items: cart.items.filter((item) => item.listingId !== listingId),
    };

    return this.render(updated, true);
  }

  private async requireCustomerId(): Promise<string> {
    const actor = await this.currentActor.getCurrentActor();
    if (!actor) {
      fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập", []);
    }
    if (actor.activeRole !== "CUSTOMER" || actor.activeProfileId !== null) {
      fail(403, "FORBIDDEN", "Chỉ Customer được sử dụng giỏ hàng", []);
    }
    return actor.userId;
  }

  private requireListingId(listingId: string): void {
    if (!listingIdSchema.safeParse(listingId).success) {
      fail(400, "INVALID_LISTING_ID", "listingId không hợp lệ", [
        { field: "listingId", code: "INVALID_LISTING_ID" },
      ]);
    }
  }

  private parseQuantity(body: unknown): number {
    const parsed = putCartItemBodySchema.safeParse(body);
    if (parsed.success) return parsed.data.quantity;

    const issue = parsed.error.issues[0];
    const field = issue?.path.length
      ? issue.path.map(String).join(".")
      : undefined;
    const invalidQuantity = field === "quantity" || field === undefined;
    const code = invalidQuantity ? "INVALID_QUANTITY" : "VALIDATION_ERROR";
    fail(400, code, "Dữ liệu cập nhật giỏ hàng không hợp lệ", [
      {
        ...(field ? { field } : {}),
        code,
        message: "Kiểm tra lại dữ liệu yêu cầu",
      },
    ]);
  }

  private async getOrCreateCart(customerId: string): Promise<CartSnapshot> {
    const existing = await this.carts.getByCustomerId(customerId);
    if (existing) return existing;

    const created: CartSnapshot = {
      cartId: randomUUID(),
      customerId,
      items: [],
    };
    await this.carts.save(created);
    return created;
  }

  private async getListing(listingId: string): Promise<ListingProjection> {
    const projections = await this.listings.getForCart([listingId]);
    const listing = projections.find((item) => item.listingId === listingId);
    if (!listing) {
      fail(404, "LISTING_NOT_FOUND", "Không tìm thấy Listing", [
        { field: "listingId", code: "LISTING_NOT_FOUND" },
      ]);
    }
    return listing;
  }

  /**
   * Builds the CartView and records, per item, the unitSalePrice that is about
   * to be shown (`lastViewedUnitSalePrice`). Workflow 3 compares this internal
   * baseline with the server quote to raise PRICE_CHANGED. The cart is saved
   * once, only when it was modified (`dirty`) or a baseline changed.
   */
  private async render(cart: CartSnapshot, dirty: boolean): Promise<CartView> {
    const projections = await this.listings.getForCart(
      cart.items.map((item) => item.listingId),
    );
    const projectionById = new Map(
      projections.map((projection) => [projection.listingId, projection]),
    );

    let baselineChanged = false;
    const storedItems: CartItem[] = [];
    const items = cart.items.map((item: CartItem) => {
      const projection = projectionById.get(item.listingId);
      if (!projection) {
        // No real price is shown, so no baseline may survive for this item.
        if (item.lastViewedUnitSalePrice !== undefined) baselineChanged = true;
        storedItems.push({ listingId: item.listingId, quantity: item.quantity });
        // Keep a removed Listing visible so GET never silently deletes cart data.
        return {
          listingId: item.listingId,
          quantity: item.quantity,
          title: "Sản phẩm không còn khả dụng",
          unitSalePrice: 0,
          currency: "VND" as const,
          availability: "UNAVAILABLE" as const,
        };
      }
      if (item.lastViewedUnitSalePrice !== projection.unitSalePrice) {
        baselineChanged = true;
      }
      storedItems.push({
        listingId: item.listingId,
        quantity: item.quantity,
        lastViewedUnitSalePrice: projection.unitSalePrice,
      });
      return {
        listingId: item.listingId,
        quantity: item.quantity,
        title: projection.title,
        unitSalePrice: projection.unitSalePrice,
        currency: projection.currency,
        availability: projection.availability,
      };
    });

    let estimatedMerchandiseTotal = 0;
    for (const item of items) {
      const lineTotal = item.unitSalePrice * item.quantity;
      const nextTotal = estimatedMerchandiseTotal + lineTotal;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(nextTotal)) {
        fail(500, "CART_TOTAL_OVERFLOW", "Tổng giỏ hàng vượt giới hạn an toàn", []);
      }
      estimatedMerchandiseTotal = nextTotal;
    }

    const view = cartViewSchema.parse({
      cartId: cart.cartId,
      items,
      estimatedMerchandiseTotal,
      currency: "VND",
    });

    // Only a view that is actually returned may become the price baseline.
    if (dirty || baselineChanged) {
      await this.carts.save({ ...cart, items: storedItems });
    }
    return view;
  }
}
