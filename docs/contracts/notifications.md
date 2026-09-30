# Contract module notifications

**Owner:** Người 1. **Status:** Baseline v1.0 cho Pha A. **Consumers/producers:** orders, payments, fulfillment, disputes, settlements, listings.

## Input và xử lý

- Notifications nhận outbox event v1 từ common; không đọc thẳng bảng nghiệp vụ của module khác để tự suy trạng thái.
- Event tối thiểu: OrderConfirmed, PaymentSucceeded, FulfillmentShipped, FulfillmentDelivered, RefundCompleted, SettlementEligible; ListingPausedByPolicy, ReturnRequested và FulfillmentTimedOut được bổ sung trong contract producer.
- Deduplicate bằng (eventId, recipientUserId, templateKey). Retry delivery không tạo hai thông báo nghiệp vụ. Có thể dùng in-app/mock dispatch ở MVP.
- PII trong payload phải tối thiểu. Notifications lấy dữ liệu đúng quyền qua port hoặc dùng snapshot đã mask; không nhúng địa chỉ/số điện thoại đầy đủ trong broadcast.

## Port/event mẫu

    {"eventId":"11111111-1111-4111-8111-111111111111","eventType":"FulfillmentShipped","eventVersion":1,"aggregateId":"44444444-4444-4444-8444-444444444444","occurredAt":"2026-10-01T10:00:00Z","correlationId":"22222222-2222-4222-8222-222222222222","payload":{"fulfillmentOrderId":"44444444-4444-4444-8444-444444444444","trackingNo":"TRACK-001"}}

GET /api/v1/notifications trả danh sách thông báo của CurrentActor.userId; POST /api/v1/notifications/{id}/read đánh dấu đã đọc idempotent. Cả hai yêu cầu xác thực và ownership. Chưa có template thì ghi lỗi delivery để retry/quan sát, không rollback đơn hàng đã commit.

## Gate

- Mỗi producer nêu recipient/trigger trong contract module mình; notifications quản lý template và trạng thái gửi.
- Test event lặp, consumer retry, actor khác đọc notification, và mask PII. Không dùng email thật để chặn Pha A.
