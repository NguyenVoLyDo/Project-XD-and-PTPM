# Contract module orders (bao gồm checkout)

**Owner:** Người 3. **Consumers:** Customer frontend, Người 1 notifications, Người 2 inventory, Người 4 payments/fulfillment. **Status:** Baseline v1.0 cho Pha A. **Nguồn:** docs/03, 04, 05 SD-01, 07 §§7.2/7.8–7.10, 08 FR-04/09/11, 09 §9.9.

## Phạm vi và quyền sở hữu

- Orders sở hữu CustomerOrder, OrderItem snapshot, checkout orchestration, idempotency request và projection cho Customer. Fulfillment vận hành trạng thái đơn con; Payments sở hữu trạng thái thanh toán; Inventory sở hữu reservation.
- Một checkout tạo **một CustomerOrder**, N FulfillmentOrder nhóm theo **(supplierId, sellerId)**. Mỗi OrderItem phân vào đúng một FulfillmentOrder qua FulfillmentItem. Một FulfillmentOrder có tối đa một Shipment trong MVP.
- Customer chỉ đọc đơn của mình; Supplier/Seller nhận DTO riêng qua fulfillment theo quyền. Không phát PII đầy đủ trong event công khai.

## Checkout API v1

POST /api/v1/checkout. Đây là path v1; docs/07 ghi tên endpoint không có prefix.

Headers: Authorization/session và Idempotency-Key (bắt buộc, scope theo Customer). Body v1:

    {
      "cartId": "11111111-1111-4111-8111-111111111111",
      "shippingAddress": {
        "recipientName": "Khách mẫu",
        "phone": "0900000000",
        "line1": "Địa chỉ mẫu",
        "wardCode": "00001",
        "provinceCode": "01"
      },
      "paymentMethod": "COD"
    }

Địa chỉ snapshot v1 gồm recipientName, phone, line1, wardCode, provinceCode. Client không gửi salePrice, costPrice, supplierId, sellerId, totalPayable. Idempotency hash chỉ trên body đã chuẩn hóa; replay cùng key/body trả response đã lưu trước khi đọc Cart hiện tại.

**Response v1** sau commit:

    {
      "orderId": "33333333-3333-4333-8333-333333333333",
      "orderNo": "DC-EXAMPLE-001",
      "status": "CONFIRMED",
      "fulfillmentSummary": "UNFULFILLED",
      "paymentMethod": "COD",
      "paymentStatus": "PENDING_COD",
      "currency": "VND",
      "totalPayable": 300000,
      "fulfillmentOrders": [
        {
          "fulfillmentOrderId": "44444444-4444-4444-8444-444444444444",
          "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "sellerId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "status": "PENDING_ACCEPTANCE",
          "amountToCollect": 150000
        },
        {
          "fulfillmentOrderId": "55555555-5555-4555-8555-555555555555",
          "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "sellerId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "status": "PENDING_ACCEPTANCE",
          "amountToCollect": 150000
        }
      ]
    }

Fixture dùng cùng Supplier nhưng hai Seller để bắt lỗi split sai. Với Online, status đầu PENDING_PAYMENT, paymentStatus PENDING; response có paymentIntentId, provider action được tạo sau commit qua Payments adapter.

## Transaction và idempotency

1. Xác thực Customer và giữ Idempotency-Key theo (customerId, key). Cùng key + payload canonical giống nhau trả cùng order/response; key cũ + payload khác trả 409 IDEMPOTENCY_KEY_REUSED. Hai request đồng thời cùng key chỉ tạo một tập side effect.
2. Trong **một PostgreSQL transaction**: đọc/khóa listing và tồn theo port, kiểm đủ tồn bằng cập nhật có điều kiện, snapshot giá/tên/địa chỉ, tạo CustomerOrder/OrderItem/FulfillmentOrder/FulfillmentItem, StockReservation HELD, Payment Intent/Allocation, idempotency record và Outbox Event. Orders điều phối transaction; port của Inventory/Payments phải tham gia cùng transaction mà không cho Orders import repository/entity nội bộ.
3. Mỗi PaymentAllocation gắn đúng một FulfillmentOrder; merchandiseAmount + shippingAmount - discountAmount = amountToCollect. grandTotal là tổng checkout ban đầu bất biến; totalPayable bằng tổng amountToCollect của allocation còn hiệu lực và chỉ đổi cùng transaction void/refund. Amount snapshot từng allocation không đổi. VND là số nguyên. Trong MVP v1, shippingAmount và discountAmount bằng 0; khi có chính sách phí/giảm giá phải tăng version contract trước khi áp dụng.
4. Chỉ sau commit mới gọi provider hoặc phát notification. Không gọi HTTP/provider trong transaction. Nếu lỗi trong transaction, không để order/reservation/allocation mồ côi.
5. Giá, cost, tên Product/Listing và địa chỉ giao là snapshot; không tính lại từ Product/Profile hiện hành khi đọc order.

**Lưu ý:** Mock/in-memory kiểm tra logic/idempotency mô phỏng, không chứng minh atomicity hay stock race của PostgreSQL. Pha B bắt buộc test giao dịch thật.

## Query API v1

| Method/path | Mục đích | Quyền |
|---|---|---|
| GET /api/v1/orders | Danh sách order của Current Customer, phân trang | Customer sở hữu |
| GET /api/v1/orders/{orderId} | Chi tiết order cha, items, fulfillment summary, payment view | Customer sở hữu |

Không nhận lệnh đổi trực tiếp fulfillmentSummary. Payment status lấy từ Payments; summary là projection từ FulfillmentOrders. Customer khác đọc order trả 403 FORBIDDEN, không lộ PII.

## Status và lỗi

| Tình huống | HTTP / code |
|---|---|
| Thiếu key/body sai: 400 INVALID_REQUEST; cart rỗng: 409 EMPTY_CART |
| Chưa đăng nhập / sai role | 401 / 403 theo Identity |
| Listing không khả dụng: 409 LISTING_PAUSED_BY_POLICY/LISTING_UNAVAILABLE; giá đổi: 409 PRICE_CHANGED với item hiện hành |
| Không đủ tồn | 409 / INSUFFICIENT_STOCK với listingId và availableQuantity nếu được phép |
| Key cũ, payload khác | 409 / IDEMPOTENCY_KEY_REUSED |
| Hai request trùng key/payload | Trả cùng order, không tạo side effect mới |

CustomerOrder.status là vòng đời checkout/payment; fulfillmentSummary là projection và chứa PARTIALLY_CANCELED. PaymentStatus độc lập. Tài liệu nghiệp vụ được đồng bộ theo quy ước này.

## Event bàn giao v1

- Orders ghi OrderCreated trong checkout transaction; khi COD CONFIRMED hoặc Online payment thành công, Orders phát OrderConfirmed qua outbox. Event dùng envelope v1 common và payload tối thiểu orderId/fulfillmentOrderIds; Notifications/Fulfillment truy DTO theo role.
- Event thay đổi order do callback payment, timeout hoặc fulfillment được ghi idempotent, có sourceRef/reasonCode; owner phát event cần thống nhất với Payments/Fulfillment để không có hai producer cho cùng transition.

## Kiểm chứng bắt buộc

1. Hai Listing cùng Supplier, khác Seller → 1 CustomerOrder và 2 FulfillmentOrder, đúng allocation.
2. Cùng key/payload gửi đồng thời → 1 order, 1 tập reservation/allocation/outbox; payload khác → 409.
3. Hai Customer tranh 1 đơn vị tồn → chỉ một checkout thành công, tồn không âm, không có reservation mồ côi.
4. COD và Online có trạng thái ban đầu đúng; callback trùng và timeout lặp không chuyển trạng thái hai lần.
5. Từ chối một đơn con chỉ void/refund allocation liên quan; order còn lại giữ nguyên.
6. Customer khác không đọc được đơn/địa chỉ của chủ đơn.

## Quyết định v1 và gate tích hợp

- Checkout dùng POST /api/v1/checkout, Idempotency-Key bắt buộc theo Customer. Same key/body canonical trả cùng stored response; khác body trả 409 IDEMPOTENCY_KEY_REUSED. Request hash không phụ thuộc Cart hiện tại khi replay.
- Cart chỉ hỗ trợ Customer đăng nhập. Giá đổi sau khi xem Cart trả 409 PRICE_CHANGED; khách xác nhận lại. Shipping/discount = 0 trong MVP fixture; amountToCollect của mỗi nhóm bằng merchandiseAmount, tổng bằng totalPayable.
- Orders mở transaction common; Listings quote, Inventory hold, Fulfillment createInitialInCheckout, Payments createCheckoutObligation cùng context. Orders ghi Order/Item snapshot, idempotency record và outbox. External provider chỉ sau commit.
- Payments event thay đổi status checkout; Fulfillment event thay đổi fulfillmentSummary. Online timeout do Payments job, Supplier timeout do Fulfillment job. Không chuyển summary bằng API ghi trực tiếp.
- DB integration gate: bổ sung shippingAddressSnapshot, bigint VND, unique reservation active, idempotency response/hash và các constraints cần thiết qua migration; test trên PostgreSQL thật cho race/rollback. Mock chỉ chứng minh logic.
