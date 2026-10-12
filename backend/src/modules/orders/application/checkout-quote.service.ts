import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { checkoutQuoteSchema } from "../api/contracts";
import type {
  CheckoutCartItem,
  CheckoutQuotation,
  CheckoutQuote,
  ListingRejectionCode,
  QuotedCheckoutLine,
} from "../domain/order";
import { failOrders, type OrdersErrorDetail } from "./errors";
import {
  ORDERS_CART_READER,
  ORDERS_INVENTORY,
  ORDERS_LISTINGS_QUOTE,
  type CartReaderPort,
  type CheckoutTransactionContext,
  type InventoryPort,
  type ListingsQuotePort,
} from "./ports";

/** Top-level checkout codes, highest priority first (orders.md §Status). */
type CheckoutIssueCode =
  | "LISTING_PAUSED_BY_POLICY"
  | "LISTING_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED";

const ISSUE_PRIORITY: readonly CheckoutIssueCode[] = [
  "LISTING_PAUSED_BY_POLICY",
  "LISTING_UNAVAILABLE",
  "INSUFFICIENT_STOCK",
  "PRICE_CHANGED",
];

const ISSUE_MESSAGES: Record<CheckoutIssueCode, string> = {
  LISTING_PAUSED_BY_POLICY: "Sản phẩm tạm ngưng theo chính sách",
  LISTING_UNAVAILABLE: "Sản phẩm hiện không khả dụng",
  INSUFFICIENT_STOCK: "Sản phẩm không còn đủ số lượng",
  PRICE_CHANGED: "Giá đã thay đổi, vui lòng xác nhận lại",
};

interface CheckoutIssue {
  readonly topCode: CheckoutIssueCode;
  readonly detail: OrdersErrorDetail;
}

const cartItemSchema = z.object({
  listingId: z.uuid(),
  quantity: z.int().positive().safe(),
  lastViewedUnitSalePrice: z.int().nonnegative().safe().optional(),
});

/**
 * Workflow 3 — revalidates the Customer's Cart and builds a server-side quote.
 *
 * Prices, cost, ownership (supplierId/sellerId) and names come exclusively
 * from `ListingsQuotePort`; the Cart only supplies listingId/quantity and the
 * internal `lastViewedUnitSalePrice` baseline used to detect PRICE_CHANGED.
 * Stock here is an early, read-only check; Inventory `holdStock` inside the
 * checkout transaction (Workflow 5) remains the authoritative guard.
 */
@Injectable()
export class CheckoutQuoteService {
  constructor(
    @Inject(ORDERS_CART_READER) private readonly cartReader: CartReaderPort,
    @Inject(ORDERS_LISTINGS_QUOTE)
    private readonly listings: ListingsQuotePort,
    @Inject(ORDERS_INVENTORY) private readonly inventory: InventoryPort,
  ) {}

  async quote(
    customerId: string,
    cartId: string,
    context: CheckoutTransactionContext,
  ): Promise<CheckoutQuotation> {
    const cart = await this.cartReader.getForCheckout(customerId);
    if (!cart || cart.items.length === 0) {
      failOrders(409, "EMPTY_CART", "Giỏ hàng đang trống");
    }
    if (cart.cartId !== cartId) {
      failOrders(400, "INVALID_REQUEST", "Giỏ hàng không hợp lệ", [
        { field: "cartId", code: "CART_MISMATCH" },
      ]);
    }
    const items = this.validateCartItems(cart.items);

    const batch = await this.listings.getCheckoutQuotes(
      items.map((item) => item.listingId),
      context,
    );
    const quoteById = this.indexQuotes(batch.quotes, items);
    const rejectionById = new Map<string, ListingRejectionCode>(
      batch.rejections.map((rejection) => [rejection.listingId, rejection.code]),
    );
    const usableQuote = (listingId: string): CheckoutQuote | undefined =>
      rejectionById.has(listingId) ? undefined : quoteById.get(listingId);

    // The same Product may appear through several Listings (different Sellers),
    // so stock is checked against the total requested per Product.
    const requestedByProduct = new Map<string, number>();
    for (const item of items) {
      const quote = usableQuote(item.listingId);
      if (!quote) continue;
      const total = (requestedByProduct.get(quote.productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(total)) this.overflow();
      requestedByProduct.set(quote.productId, total);
    }
    const availableByProduct = new Map<string, number>(
      await Promise.all(
        [...requestedByProduct.keys()].map(
          async (productId) =>
            [productId, await this.inventory.getAvailability(productId)] as const,
        ),
      ),
    );

    const issues: CheckoutIssue[] = [];
    const lines: QuotedCheckoutLine[] = [];
    items.forEach((item, lineIndex) => {
      const field = `items[${lineIndex}]`;
      const quote = usableQuote(item.listingId);

      if (!quote) {
        const code = rejectionById.get(item.listingId) ?? "LISTING_UNAVAILABLE";
        issues.push({
          topCode:
            code === "LISTING_PAUSED_BY_POLICY"
              ? "LISTING_PAUSED_BY_POLICY"
              : "LISTING_UNAVAILABLE",
          detail: { field, code, listingId: item.listingId },
        });
        return;
      }

      const available = Math.max(0, availableByProduct.get(quote.productId) ?? 0);
      if ((requestedByProduct.get(quote.productId) ?? 0) > available) {
        issues.push({
          topCode: "INSUFFICIENT_STOCK",
          detail: {
            field,
            code: "INSUFFICIENT_STOCK",
            listingId: item.listingId,
            availableQuantity: available,
          },
        });
        return;
      }

      // No baseline means the Customer never saw a price: require confirmation.
      if (item.lastViewedUnitSalePrice !== quote.unitSalePrice) {
        issues.push({
          topCode: "PRICE_CHANGED",
          detail: {
            field,
            code: "PRICE_CHANGED",
            listingId: item.listingId,
            currentUnitSalePrice: quote.unitSalePrice,
            currency: quote.currency,
          },
        });
        return;
      }

      lines.push(this.toLine(lineIndex, item, quote));
    });

    if (issues.length > 0) {
      const topCode = ISSUE_PRIORITY.find((code) =>
        issues.some((issue) => issue.topCode === code),
      ) as CheckoutIssueCode;
      failOrders(
        409,
        topCode,
        ISSUE_MESSAGES[topCode],
        issues.map((issue) => issue.detail),
      );
    }

    let merchandiseTotal = 0;
    for (const line of lines) {
      merchandiseTotal += line.lineSaleTotal;
      if (!Number.isSafeInteger(merchandiseTotal)) this.overflow();
    }

    return {
      customerId,
      cartId: cart.cartId,
      lines,
      merchandiseTotal,
      currency: "VND",
    };
  }

  /** Cart data is server-owned, so a malformed item is an internal fault. */
  private validateCartItems(
    items: readonly CheckoutCartItem[],
  ): readonly CheckoutCartItem[] {
    const seen = new Set<string>();
    for (const item of items) {
      if (!cartItemSchema.safeParse(item).success || seen.has(item.listingId)) {
        failOrders(500, "CART_DATA_INVALID", "Dữ liệu giỏ hàng không hợp lệ");
      }
      seen.add(item.listingId);
    }
    return items;
  }

  /** Validates quotes against the v1 shape and ignores unrequested listings. */
  private indexQuotes(
    quotes: readonly CheckoutQuote[],
    items: readonly CheckoutCartItem[],
  ): ReadonlyMap<string, CheckoutQuote> {
    const requested = new Set(items.map((item) => item.listingId));
    const byId = new Map<string, CheckoutQuote>();
    for (const raw of quotes) {
      const parsed = checkoutQuoteSchema.safeParse(raw);
      if (!parsed.success || byId.has(parsed.data.listingId)) {
        failOrders(500, "LISTING_QUOTE_INVALID", "Báo giá sản phẩm không hợp lệ");
      }
      if (requested.has(parsed.data.listingId)) {
        byId.set(parsed.data.listingId, parsed.data);
      }
    }
    return byId;
  }

  private toLine(
    lineIndex: number,
    item: CheckoutCartItem,
    quote: CheckoutQuote,
  ): QuotedCheckoutLine {
    const lineSaleTotal = quote.unitSalePrice * item.quantity;
    const lineCostTotal = quote.unitCostPrice * item.quantity;
    if (!Number.isSafeInteger(lineSaleTotal) || !Number.isSafeInteger(lineCostTotal)) {
      this.overflow();
    }
    return {
      lineIndex,
      listingId: quote.listingId,
      productId: quote.productId,
      supplierId: quote.supplierId,
      sellerId: quote.sellerId,
      productName: quote.productName,
      listingTitle: quote.listingTitle,
      quantity: item.quantity,
      unitSalePrice: quote.unitSalePrice,
      unitCostPrice: quote.unitCostPrice,
      lineSaleTotal,
      lineCostTotal,
      currency: "VND",
    };
  }

  private overflow(): never {
    failOrders(
      500,
      "CHECKOUT_TOTAL_OVERFLOW",
      "Tổng đơn hàng vượt giới hạn an toàn",
    );
  }
}
