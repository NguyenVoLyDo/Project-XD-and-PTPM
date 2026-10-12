# Orders module — Workflow 1–4

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

## Workflow 4 — Checkout request và chống lặp (Idempotency)

`CheckoutService.checkout(idempotencyKey, body)` (trong `application/checkout.service.ts`, được gọi từ `CheckoutController` tại `POST /api/v1/checkout`):

1. **Xác thực Actor**: Kiểm tra `CurrentActorPort`. Chưa đăng nhập → `401 UNAUTHORIZED`. Role khác `CUSTOMER` hoặc `activeProfileId !== null` → `403 FORBIDDEN`.
2. **Kiểm tra Header & DTO**:
   - `Idempotency-Key` (chuỗi không rỗng sau khi trim) → thiếu/rỗng trả `400 INVALID_REQUEST` (`detail: {field: "Idempotency-Key", code: "REQUIRED"}`).
   - Request body tuân thủ `checkoutRequestSchema` (strict Zod schema: `cartId`, `shippingAddress`, `paymentMethod`). Dữ liệu sai hoặc thừa thuộc tính → `400 INVALID_REQUEST`.
3. **Canonical Hash**:
   - Chuẩn hóa payload bằng cách đệ quy sắp xếp key của các object (`canonicalJson`), sau đó băm SHA-256 (`computeCheckoutRequestHash`).
   - Hai request body có thứ tự trường khác nhau nhưng nội dung giống nhau sẽ cho cùng một `requestHash`.
4. **Idempotency Scope & Replay**:
   - Khóa tra cứu scoped theo `(customerId, key)`. Khách hàng B dùng cùng key với khách hàng A hoàn toàn không bị xung đột.
   - Kiểm tra `IdempotencyPort.find(customerId, key)` **trước khi đọc Cart hiện hành**:
     - Cùng key + cùng `requestHash` → **Replay**: trả ngay `storedRecord.response` đã lưu, không đọc Cart, không gọi executor lần 2 (ngay cả khi Cart đã bị xóa hoặc sửa sau đó).
     - Cùng key + khác `requestHash` → **Conflict**: trả `409 IDEMPOTENCY_KEY_REUSED`.
5. **Thực thi đơn mới**:
   - Chưa tồn tại bản ghi idempotency → chuyển cho `CheckoutExecutorPort.execute` (Workflow 5 sẽ thực thi transaction nguyên tử và lưu bản ghi idempotency cùng commit).

