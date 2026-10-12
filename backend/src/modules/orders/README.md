# Orders module — Workflow 1–3

Contract: `docs/contracts/orders.md`, with consumer ports shaped by Common, Cart, Listings, Inventory, Fulfillment and Payments v1. All mocks and fixtures live here. Checkout prices come from `ListingsQuotePort`, never from Cart. The two checkout fixtures use one Supplier and two Sellers. `CheckoutTransactionContext` is intentionally opaque; Common's adapter will replace the local mock in Phase B.

Run from repository root: `pnpm.cmd --dir backend exec vitest run src/modules/orders/tests`. Compile independently with `pnpm.cmd --dir backend exec tsc -p src/modules/orders/tsconfig.json`. Mocks prove wiring and contract shapes only; `MockTransaction` does not provide rollback, locking or outbox-after-commit semantics. Those are verified in later workflows and PostgreSQL integration.

## Workflow 3 — Revalidate Cart and checkout quote

`CheckoutQuoteService.quote(customerId, cartId, txContext)` (in `application/checkout-quote.service.ts`, provided by `OrdersModule.register({ cartReader, listingsQuote, inventory })`) returns a `CheckoutQuotation`: server-verified lines (listing/product/supplier/seller, names, unit sale/cost price, line totals) and an integer VND `merchandiseTotal`. It is the only input Workflow 5 may snapshot and split. It never reads a price from the request or uses the Cart baseline as the payable price.

Order of checks:

1. `CartReader.getForCheckout(customerId)`; missing/empty cart → `409 EMPTY_CART`. `cartId` different from the Customer's cart → `400 INVALID_REQUEST` with detail `{field:"cartId", code:"CART_MISMATCH"}`.
2. `ListingsQuotePort.getCheckoutQuotes(listingIds, txContext)` returns `{quotes, rejections}`. Quotes are re-validated against `checkoutQuoteSchema` (malformed → `500 LISTING_QUOTE_INVALID`). A listing that is rejected, or silently omitted, cannot be bought.
3. Stock pre-check with `InventoryPort.getAvailability(productId)`, summing the requested quantity **per Product** (two Sellers may list the same Product). This is read-only; `holdStock` in the Workflow 5 transaction stays authoritative.
4. Price comparison against the Cart baseline (below).

Each item gets at most one issue (listing > stock > price). All failing items are listed in `details` (`field: "items[n]"`, `code`, `listingId`, plus `availableQuantity` or `currentUnitSalePrice`/`currency`). The top-level code is picked by priority `LISTING_PAUSED_BY_POLICY` > `LISTING_UNAVAILABLE` > `INSUFFICIENT_STOCK` > `PRICE_CHANGED`, always HTTP 409. `LISTING_NOT_FOUND` from Listings is reported as top-level `LISTING_UNAVAILABLE` (the checkout contract only defines 409 listing codes) while the detail keeps `LISTING_NOT_FOUND`.

### Price baseline decision (PRICE_CHANGED)

Cart v1 sends only `listingId`/`quantity`, so the server keeps an internal baseline per cart item: `lastViewedUnitSalePrice`.

- **Write:** Cart sets it to the `unitSalePrice` of every CartView it returns (GET, PUT, DELETE). It is persisted only after the view is built; items without a Listing projection lose their baseline. It is not in the public `CartView`, is not a locked price and is never accepted from the client.
- **Read:** `CartReader.getForCheckout` passes it to Orders. If the quote's `unitSalePrice` differs → `409 PRICE_CHANGED` with the current price.
- **Old cart without baseline:** treated as `PRICE_CHANGED` (the Customer never saw a price). Viewing the cart again records the baseline; the Customer then confirms with a new checkout request.

No public DTO changed. The only internal shape change is `ListingsQuotePort.getCheckoutQuotes` returning `CheckoutQuoteBatch` instead of a bare array, so item-level codes from `contracts/listings.md` can reach Orders; the Listings owner's adapter must map to it in Phase B.
