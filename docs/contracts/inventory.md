# Contract điểm nối module inventory ↔ orders/fulfillment

**Owner:** Người 2. **Consumers:** orders Người 3, fulfillment Người 4. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/03 §3.5, docs/07 INV-01–05 và §7.9, docs/09 §9.9, docs/10 handoff.

## Phạm vi

Inventory là owner của StockReservation và thao tác hold/commit/release. Orders không sửa trực tiếp bảng Product/StockReservation; Fulfillment không tự trừ tồn. availableStock không bao giờ âm. Reservation gắn một OrderItem có UUID do Orders tạo trước khi persist.

## Port nội bộ v1

| Port | Input bắt buộc | Output | Quy tắc |
|---|---|---|---|
| holdStock | txContext, orderItemId, productId, quantity, expiresAt | reservationId, status=HELD, expiresAt | Kiểm tồn/cập nhật có điều kiện trong **cùng PostgreSQL transaction checkout**. |
| commitStock | reservationId, fulfillmentOrderId, reason/sourceRef | status=COMMITTED | Chỉ khi Supplier accept và payment hợp lệ; idempotent. |
| releaseStock | reservationId, reason/sourceRef | status=RELEASED | Payment failed/timeout, Supplier reject, hủy hợp lệ; idempotent. |
| getAvailability | productId/listing context | availableQuantity hoặc khả dụng | Chỉ tham khảo UI; không thay thế holdStock lúc checkout. |

Đây là chữ ký logic v1. txContext là CheckoutTransactionContext từ common; Orders không import Inventory repository/entity. Commit/release dùng transaction context của caller khi cần cùng thay đổi Payment/Fulfillment.

## Fixture request/response cho holdStock

    {
      "orderItemId": "99999999-9999-4999-8999-999999999999",
      "productId": "77777777-7777-4777-8777-777777777777",
      "quantity": 2,
      "expiresAt": "2026-10-01T10:15:00Z"
    }

    {
      "reservationId": "aaaaaaaa-1111-4111-8111-111111111111",
      "orderItemId": "99999999-9999-4999-8999-999999999999",
      "quantity": 2,
      "status": "HELD",
      "expiresAt": "2026-10-01T10:15:00Z"
    }

Thời gian chỉ là fixture. TTL Online 15 phút do Payments job xử lý; COD chưa Supplier accept 24 giờ do Fulfillment job xử lý. Cả hai cấu hình server và idempotent.

## Bất biến và lỗi

- Điều kiện tồn tương đương on_hand - reserved >= requestedQuantity phải được kiểm bằng thao tác nguyên tử/khóa phù hợp; không chỉ SELECT rồi UPDATE không điều kiện.
- Một OrderItem có tối đa một reservation active; duplicate hold cùng orderItemId không giữ tồn thêm lần hai. init.sql hiện chưa thấy unique active constraint này dù docs/09 yêu cầu; migration cần bổ sung/review.
- HELD → COMMITTED hoặc RELEASED một lần; lặp lại cùng hành động trả trạng thái đã đạt. Chuyển COMMITTED ↔ RELEASED bị từ chối hoặc xử lý bằng adjustment riêng, không tái dùng reservation.
- Thiếu tồn trả INSUFFICIENT_STOCK với productId/listingId/quantity theo schema lỗi item-level đã chốt; lỗi phải rollback toàn checkout.
- Hàng trả tạo InventoryAdjustment mới, không chuyển reservation COMMITTED về HELD.

## Kiểm chứng bàn giao

1. Hai checkout cùng SKU, tồn chỉ đủ một → đúng một hold thành công, availableStock không âm.
2. Gọi hold lặp cùng orderItemId → một reservation và một lần giữ tồn.
3. Gọi release/commit lặp → không trừ/trả tồn thêm.
4. Checkout lỗi sau hold → transaction rollback, không có reservation mồ côi.
5. Supplier reject một đơn con → chỉ release reservations thuộc FulfillmentOrder đó.

## Quyết định v1 và nghiệm thu

- holdStock(txContext, orderItemId, productId, quantity, expiresAt) kiểm tồn/cập nhật có điều kiện trong transaction Orders mở. Unique active reservation theo OrderItem cần migration trước DB integration.
- commitStock/releaseStock dùng reservationId + sourceRef; lặp cùng sourceRef không tạo hiệu ứng mới. Chỉ Fulfillment accept mới commit; Payments Online timeout hoặc Fulfillment reject/timeout release.
- Không âm on_hand - reserved. Lỗi thiếu tồn: 409 INSUFFICIENT_STOCK với item-level detail.
- Contract test: race một SKU tồn 1; rollback sau hold; duplicate hold/commit/release; reject một đơn con chỉ nhả reservation liên quan.

## API v1 quản lý tồn cho Supplier

| API | Quyền | Request/response chính |
|---|---|---|
| GET /api/v1/supplier/inventory/products/{productId} | Supplier chủ Product | onHand, reserved, available = onHand - reserved |
| POST /api/v1/supplier/inventory/adjustments | Supplier chủ Product | productId, delta, reasonCode, sourceRef → adjustmentId và số lượng sau thay đổi |

Adjustment phải nguyên tử, audit actor và không làm onHand < reserved hoặc available < 0. Cùng sourceRef chỉ áp dụng một lần. Không để Supplier gọi trực tiếp holdStock/commitStock/releaseStock qua public API; đó là port cho Orders/Fulfillment/Payments.

    {"productId":"77777777-7777-4777-8777-777777777777","delta":10,"reasonCode":"RECEIVED_STOCK","sourceRef":"stock-receipt-001"}

    {"adjustmentId":"aaaaaaaa-3333-4333-8333-333333333333","onHand":10,"reserved":0,"available":10}

Lỗi: 403 khác owner; 404 PRODUCT_NOT_FOUND; 409 STOCK_ADJUSTMENT_CONFLICT nếu giảm xuống dưới reserved; 409 INSUFFICIENT_STOCK cho hold. Test adjustment lặp, tranh hold/adjust, rollback và không âm tồn.
