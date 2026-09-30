# Contract điểm nối module fulfillment ↔ orders/inventory/payments

**Owner:** Người 4. **Consumers:** orders Người 3, inventory Người 2, settlements/disputes Người 4, notifications Người 1. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/03 §3.2, docs/07 §§7.4/7.10/7.12/7.13, docs/08 FR-04/06/07/13.

## Phạm vi

Orders điều phối Fulfillment.createInitialInCheckout(txContext, groups) để Fulfillment tạo record FulfillmentOrder/FulfillmentItem trong checkout transaction. Sau commit, Fulfillment sở hữu mọi transition vận hành và shipment; Orders chỉ đọc projection/event.

## Bàn giao từ orders

Mỗi FulfillmentOrder mới có fulfillmentOrderId, customerOrderId, supplierId, sellerId, item IDs/quantity, status=PENDING_ACCEPTANCE, paymentAllocationId, reservationIds, hạn xác nhận và địa chỉ giao snapshot được phép chia sẻ. Tạo đúng một đơn con cho một cặp; một đơn con có tối đa một Shipment/trackingNo trong MVP.

    {
      "fulfillmentOrderId": "44444444-4444-4444-8444-444444444444",
      "customerOrderId": "33333333-3333-4333-8333-333333333333",
      "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "sellerId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "status": "PENDING_ACCEPTANCE",
      "orderItemIds": ["99999999-9999-4999-8999-999999999999"],
      "reservationIds": ["aaaaaaaa-1111-4111-8111-111111111111"],
      "paymentAllocationId": "ffffffff-ffff-4fff-8fff-ffffffffffff"
    }

Tên và cách lấy địa chỉ snapshot có PII cần contract riêng theo role; không đặt địa chỉ/điện thoại vào event broadcast.

## Transition tối thiểu

| Từ → đến | Actor/điều kiện | Tác động bắt buộc |
|---|---|---|
| PENDING_ACCEPTANCE → ACCEPTED | Supplier sở hữu, reservation còn hiệu lực | Commit đúng reservation một lần, audit. |
| PENDING_ACCEPTANCE → REJECTED | Supplier sở hữu/Admin, có reasonCode | Release reservation; void/refund đúng allocation, audit. |
| ACCEPTED → PACKING → READY_TO_SHIP → SHIPPED | Supplier/Carrier có quyền; trackingNo khi ship | Ghi shipment và event trạng thái. |
| SHIPPED/IN_TRANSIT → DELIVERED | Carrier/Supplier có bằng chứng | Ghi thời điểm/bằng chứng, mở cửa sổ đổi trả. |

Các transition RETURN_REQUESTED/RETURNING/RETURNED/REFUNDED, delivery retry <3 và timeout chi tiết theo docs/03; Người 4 khóa đầy đủ trong contract của mình. Lệnh lặp cùng sourceRef/eventId không commit/release/refund hai lần.

## Đầu ra cho orders

Fulfillment cung cấp projection theo CustomerOrder gồm từng fulfillmentOrderId/status và các mốc cần hiển thị. Orders tính fulfillmentSummary từ danh sách đơn con; không nhận lệnh gán summary độc lập. PaymentStatus lấy từ Payments, không suy từ FulfillmentStatus.

Supplier chỉ xem PII giao hàng của đơn thuộc mình sau khi CustomerOrder CONFIRMED. Seller chỉ xem thông tin Shop và địa chỉ đã mask; không thấy đầy đủ số điện thoại/địa chỉ. Admin xem PII khi có lý do nghiệp vụ và audit.

## Event v1

FulfillmentAccepted, FulfillmentRejected, FulfillmentShipped, FulfillmentDelivered, FulfillmentTimedOut dùng envelope v1 của common. Fulfillment là producer; Orders tiêu thụ để tính fulfillmentSummary; Notifications tiêu thụ để gửi đúng role.

## Kiểm chứng bàn giao

- Supplier B không cập nhật đơn của Supplier A; Seller không xem địa chỉ đầy đủ.
- Accept lặp chỉ trừ tồn một lần; reject lặp chỉ release/refund một lần.
- Reject một đơn con không đổi status/tiền/tồn của đơn con khác.
- Một đơn con có tối đa một Shipment; partial shipment trả lỗi nghiệp vụ rõ ràng.
- Supplier timeout 24 giờ, job chạy lặp không tạo refund/void/audit nghiệp vụ trùng.

## Quyết định v1 và nghiệm thu

- Fulfillment.createInitialInCheckout nhận groups theo (supplierId,sellerId) và tạo đơn con trong transaction Orders mở; status ban đầu PENDING_ACCEPTANCE.
- Fulfillment sở hữu job Supplier accept 24 giờ: auto-cancel với reasonCode SUPPLIER_TIMEOUT, release reservation và yêu cầu Payments refund/void đúng allocation. Ship warning 48 giờ tạo cảnh báo/Admin task; không auto-refund.
- Supplier chỉ nhận PII giao hàng của đơn mình sau CustomerOrder CONFIRMED; Seller nhận địa chỉ mask. Một FulfillmentOrder tối đa một Shipment/trackingNo trong MVP.
- Event lặp cùng sourceRef không commit/release/refund hai lần. Contract test ownership, timeout lặp, reject một đơn con, duplicate delivery callback và single-shipment.

## API v1 vận hành đơn con

| API | Quyền | Hành vi |
|---|---|---|
| GET /api/v1/supplier/orders | Supplier APPROVED | chỉ FulfillmentOrder của activeProfileId, PII theo quy tắc |
| GET /api/v1/seller/orders | Seller APPROVED | đơn của Shop mình, địa chỉ/điện thoại đã mask |
| POST /api/v1/supplier/orders/{id}/accept | Supplier chủ đơn | PENDING_ACCEPTANCE → ACCEPTED, commit reservation |
| POST /api/v1/supplier/orders/{id}/reject | Supplier chủ đơn | reasonCode bắt buộc, release và refund/void allocation |
| POST /api/v1/supplier/orders/{id}/shipment | Supplier chủ đơn | carrierCode, trackingNo; tối đa một Shipment |
| POST /api/v1/fulfillment/carrier-events | Carrier adapter đã xác minh | eventId, trạng thái giao, deduplicate |

    {"reasonCode":"OUT_OF_STOCK","sourceRef":"supplier-reject-001"}

    {"fulfillmentOrderId":"44444444-4444-4444-8444-444444444444","status":"REJECTED","reasonCode":"OUT_OF_STOCK"}

Lỗi: 403 không chủ đơn; 404 không có đơn; 409 INVALID_FULFILLMENT_TRANSITION, SHIPMENT_ALREADY_EXISTS, RESERVATION_EXPIRED. Carrier DELIVERED sau CANCELED đưa vào exception queue cho Admin, không chuyển trạng thái tự động. Test từng transition docs/03, event lặp, tracking trùng và PII theo role.
