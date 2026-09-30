# Contract module disputes

**Owner:** Người 4. **Status:** Baseline v1.0 cho Pha A. **Consumers:** Customer, Supplier, Admin, payments, settlements, fulfillment.

## Phạm vi và trạng thái

ReturnRequest gắn một FulfillmentOrder hoặc OrderItem; không tạo yêu cầu mơ hồ cho toàn CustomerOrder. Chỉ mở trong returnWindowDays (MVP mặc định 7 ngày từ DELIVERED), trừ ngoại lệ Admin có audit.

State machine theo docs/03: REQUESTED → EVIDENCE_PENDING/UNDER_REVIEW → APPROVED/REJECTED → RETURN_IN_TRANSIT → RECEIVED → REFUND_PENDING → REFUNDED → CLOSED. REJECTED → CLOSED. Không mở lại case CLOSED với cùng reasonCode.

## API/port v1

| API | Input | Quyền |
|---|---|---|
| POST /api/v1/customer/disputes | fulfillmentOrderId, orderItemId?, reasonCode, description | Customer sở hữu đơn |
| GET /api/v1/customer/disputes/{id} | Không có body | Customer sở hữu |
| POST /api/v1/admin/disputes/{id}/decision | APPROVED/REJECTED, reasonCode | ADMIN |

Supplier chỉ xem dispute của fulfillment thuộc mình; Seller xem dữ liệu đã mask. Bằng chứng/media dùng signed URL có hạn. Disputes gọi Payments.refundAllocation(allocationId, amount, sourceRef) sau khi điều kiện hoàn hợp lệ; Settlements giữ HOLD/ghi adjustment. Một refund chỉ tính trên allocation liên quan.

    {"fulfillmentOrderId":"44444444-4444-4444-8444-444444444444","orderItemId":"99999999-9999-4999-8999-999999999999","reasonCode":"DAMAGED_ITEM","description":"Sản phẩm bị hỏng"}

    {"returnRequestId":"aaaaaaaa-2222-4222-8222-222222222222","status":"REQUESTED","fulfillmentOrderId":"44444444-4444-4444-8444-444444444444"}

    {"error":{"code":"RETURN_WINDOW_EXPIRED","message":"Đã hết thời hạn yêu cầu trả hàng","details":[]}}

## Event và kiểm chứng

ReturnRequested và DisputeDecisionRecorded phát qua outbox sau commit, có eventId/version/sourceRef. Gửi quyết định/refund lặp không tạo Refund/FinancialEntry thứ hai. Dispute mở giữ Settlement HOLD; bác bỏ đóng case nhưng không refund; duyệt và nhận hàng trả mới đi tới refund theo state. SLA Supplier phản hồi 48 giờ, Customer gửi hàng sau duyệt 72 giờ; job idempotent và audit.
