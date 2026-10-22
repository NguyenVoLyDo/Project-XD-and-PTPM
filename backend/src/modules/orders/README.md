# Orders module — Workflow 1–7

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

## Workflow 5 — Checkout tạo CustomerOrder nguyên tử

`AtomicCheckoutService.execute(context)` (trong `application/atomic-checkout.service.ts`, thực thi `CheckoutExecutorPort`):

1. **Mở transaction**: Toàn bộ thao tác thực thi trong một `CheckoutTransactionContext` từ `TransactionPort.runInTransaction`.
2. **Revalidate Cart & Quote**: Gọi `CheckoutQuoteService.quote(customerId, cartId, txContext)` để xác thực Listing, giá bán/vốn và tồn kho khả dụng.
3. **Phân nhóm Fulfillment**: Gom các dòng giỏ hàng theo cặp `(supplierId, sellerId)`. Mỗi cặp sinh ra đúng 1 `FulfillmentOrder` và `AllocationDraft`.
4. **Giữ tồn kho (Inventory Hold)**: Gọi `InventoryPort.holdStock` cho từng `OrderItem` với `expiresAt` (15 phút cho Online, 24 giờ cho COD). Nhận `reservationId` gắn vào `OrderItem`.
5. **Nghĩa vụ thanh toán (Payment Obligation)**: Gọi `PaymentsPort.createCheckoutObligation` với các allocation tương ứng từng đơn con (shipping/discount v1 bằng 0, amountToCollect bằng merchandiseAmount).
6. **Khởi tạo đơn con (Fulfillment Initial)**: Gọi `FulfillmentPort.createInitialInCheckout` với `FulfillmentDraftGroup` chứa đầy đủ `orderItemIds`, `reservationIds`, `paymentAllocationId` và địa chỉ giao hàng snapshot.
7. **Lưu trữ Order Aggregate**: Ghi `CustomerOrder` (COD: `CONFIRMED`/`PENDING_COD`; Online: `PENDING_PAYMENT`/`PENDING`), `OrderItem` snapshot và `FulfillmentOrderSnapshot` qua `OrderRepositoryPort`.
8. **Outbox Event**: Enqueue sự kiện `OrderCreated` vào `OutboxPort` chứa `orderId` và danh sách `fulfillmentOrderIds`.
9. **Lưu Idempotency Record**: Lưu `CheckoutResponse` vào `IdempotencyPort.save` trong cùng transaction trước khi commit.
10. **Nguyên tắc Atomicity & Rollback**: Lỗi ở bất kỳ port nào (Inventory, Payments, Fulfillment, Outbox, v.v.) sẽ rollback toàn bộ trong harness (hỗ trợ rollback simulation trên mocks in-memory; kiểm chứng PostgreSQL MVCC được bảo lưu cho Pha B).

## Workflow 6 — Nhận kết quả payment/fulfillment

`OrderEventConsumerService.consume(event)` (trong `application/order-event-consumer.service.ts`, thực thi `OrderEventConsumerPort`):

1. **Chống xử lý lặp (Deduplication)**:
   - Kiểm tra `ProcessedEventPort.isProcessed(event.eventId)` trong transaction.
   - Nếu event đã xử lý: trả kết quả `IGNORED_DUPLICATE` ngay lập tức, không thay đổi trạng thái và không phát outbox event lần 2.

2. **Xử lý sự kiện từ Payments (`docs/contracts/payments.md`)**:
   - `PaymentSucceeded`: Online `PENDING_PAYMENT` chuyển sang `CONFIRMED`, `paymentStatus` thành `PAID`. Phát duy nhất một lần sự kiện `OrderConfirmed` qua `OutboxPort`. Duplicate event không phát lại `OrderConfirmed`.
   - `PaymentFailed`: Online `PENDING_PAYMENT` chuyển sang `PAYMENT_FAILED`, `paymentStatus` thành `FAILED`.
   - `PaymentTimedOut`: Quá hạn thanh toán Online (15 phút) chuyển `status` và `fulfillmentSummary` sang `CANCELED`, `paymentStatus` sang `FAILED`, tất cả sub-orders chuyển `CANCELED` với lý do `ONLINE_PAYMENT_EXPIRED`, `totalPayable` về 0.
   - `PaymentCollected`: COD carrier thu tiền thành công cập nhật `paymentStatus` thành `COLLECTED`.
   - `RefundCompleted`: Cập nhật `paymentStatus` thành `REFUNDED` hoặc `PARTIALLY_REFUNDED`.

3. **Xử lý sự kiện từ Fulfillment & Projection (`docs/contracts/fulfillment.md`, `docs/03-state-machines.md`)**:
   - `computeFulfillmentSummary(fulfillmentOrders)` (trong `domain/fulfillment-projection.ts`): hàm thuần túy tính toán `fulfillmentSummary` từ trạng thái của các `FulfillmentOrder` snapshot theo đúng State Machine §3.1. Tuyệt đối không có API sửa trực tiếp summary này.
   - `FulfillmentAccepted`: Cập nhật sub-order thành `ACCEPTED`. Nếu đơn cha đang `CONFIRMED`, chuyển sang `PROCESSING`.
   - `FulfillmentRejected`: Cập nhật sub-order thành `REJECTED` kèm `reasonCode` và `sourceRef`. Đơn con còn lại giữ nguyên trạng thái. `fulfillmentSummary` trở thành `PARTIALLY_CANCELED` (hoặc `CANCELED` nếu toàn bộ đơn con bị từ chối). Cập nhật `totalPayable` trừ đi khoản phải thu của đơn con bị từ chối; `grandTotal` bất biến. Nếu toàn bộ đơn con bị từ chối, `CustomerOrder.status` chuyển `CANCELED` và COD chuyển `VOIDED`.
   - `FulfillmentTimedOut`: Xử lý Supplier timeout (24 giờ), cập nhật sub-order `CANCELED` với lý do `SUPPLIER_TIMEOUT`, `fulfillmentSummary` thành `PARTIALLY_CANCELED`, cập nhật `totalPayable`.
   - `FulfillmentShipped`: Cập nhật sub-order `SHIPPED` kèm `trackingNo` và `carrierCode`.
   - `FulfillmentDelivered`: Cập nhật sub-order `DELIVERED`, tính lại summary (`PARTIALLY_FULFILLED` khi còn đơn khác đang giao, `FULFILLED` khi tất cả đã giao).

## Workflow 7 — Customer xem Order

`OrderQueryService` (trong `application/order-query.service.ts`, được gọi từ `OrdersController` tại `GET /api/v1/orders` và `GET /api/v1/orders/{orderId}`):

1. **Xác thực quyền sở hữu và bảo mật**:
   - Yêu cầu `CurrentActorPort` hợp lệ với `activeRole === "CUSTOMER"` và `activeProfileId === null`.
   - Nếu chưa đăng nhập $\to$ `401 UNAUTHORIZED`.
   - Nếu là Supplier hoặc Seller (hoặc có activeProfileId) $\to$ `403 FORBIDDEN` (Supplier/Seller phải dùng DTO của Fulfillment, không dùng API Customer Order).
   - Khách hàng B xem đơn của Khách hàng A $\to$ `403 FORBIDDEN`, tuyệt đối không rò rỉ dữ liệu hay PII trong lỗi (tuân thủ NFR-01 và contract Common).
   - Đơn không tồn tại $\to$ `404 ORDER_NOT_FOUND`. `orderId` sai định dạng UUID $\to$ `400 INVALID_REQUEST`.

2. **Bất biến lịch sử (Historical Snapshot Invariance)**:
   - Dữ liệu chi tiết đơn hàng (`productName`, `listingTitle`, `unitSalePrice`, `lineSaleTotal`) được đọc trực tiếp từ snapshot `OrderItem` lưu trong `OrderAggregate`.
   - Không gọi lại `ListingsQuotePort` hay `Cart` để tính lại giá hiện hành. Mọi thay đổi giá bán hoặc tiêu đề Listing sau thời điểm checkout hoàn toàn không ảnh hưởng đến đơn hàng lịch sử.
   - Giá vốn `unitCostPrice` và `lineCostTotal` không bị lộ cho Customer.

3. **Tính nhất quán tổng tiền**:
   - `totalPayable` luôn khớp với tổng `amountToCollect` của các `FulfillmentOrder` đang hiệu lực.
   - `grandTotal` là giá trị tổng ban đầu bất biến.

4. **Danh sách phân trang (`GET /api/v1/orders`)**:
   - Lọc chính xác theo `customerId` của actor hiện tại.
   - Hỗ trợ tham số phân trang `page` (mặc định 1) và `limit` (mặc định 20, tối đa 100).
   - Trả về danh sách tóm tắt `CustomerOrderSummary` sắp xếp theo thời gian tạo mới nhất (`createdAt DESC`) cùng metadata phân trang `PaginationMeta`.
