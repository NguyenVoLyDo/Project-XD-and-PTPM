# Contract module common — nền tảng liên module

**Owner:** Người 1. **Status:** Baseline v1.0 cho Pha A. **Consumers:** mọi module. Common chỉ chứa hạ tầng, không chứa business logic hay mock chung.

## HTTP và CurrentActor

- REST prefix /api/v1; JSON camelCase; UUID string; thời gian ISO 8601 UTC; tiền VND là số nguyên không âm và lưu bigint ở schema mục tiêu. Không dùng số thực cho tiền.
- Response lỗi thống nhất: {"error":{"code":"STABLE_CODE","message":"Thông báo ngắn","details":[]}}. details là mảng object {field?, code?, message?}; không chứa PII/token. 400 validation; 401 chưa xác thực; 403 sai role/ownership; 404 tài nguyên không tồn tại; 409 xung đột nghiệp vụ; 500 lỗi bất ngờ. traceId có thể ở header, không buộc client phụ thuộc.
- CurrentActor được Identity tạo từ session/JWT đã xác minh: {userId, activeRole, activeProfileId}. actorId trong audit = userId; profileId là hồ sơ Supplier/Seller đang hoạt động. Customer không có profile riêng, activeProfileId = null. Client không tự gửi actorId/customerId để đổi quyền.
- API/query bắt buộc lọc owner ở backend; tài nguyên tồn tại nhưng không thuộc quyền trả 403 theo NFR-01. Không trả nội dung tài nguyên trong lỗi.

## Transaction, event và audit

- Common cung cấp CheckoutTransactionContext (opaque) và runInTransaction(callback). Orders mở transaction, Inventory/Payments/Fulfillment nhận cùng context qua public port; không import repository/entity nội bộ của module khác. Chi tiết NestJS/TypeORM do Người 1 quyết định nhưng hành vi này không đổi.
- Outbox event v1 có {eventId, eventType, eventVersion:1, aggregateId, occurredAt, correlationId, payload}. Producer ghi trong cùng transaction business; consumer deduplicate theo eventId. Publish sau commit, có thể giao ít nhất một lần.
- Tên event dùng PascalCase trong docs/06 (OrderConfirmed, PaymentSucceeded, FulfillmentShipped, FulfillmentDelivered, RefundCompleted, SettlementEligible). Event mới ghi trong contract owner trước khi phát.
- Audit thay đổi trạng thái có actorId, action, entityType, entityId, reasonCode/sourceRef, occurredAt. System job dùng actorId=null và sourceRef bắt buộc. Không ghi secret/PII thô vào log.

## Mẫu

    {"error":{"code":"INSUFFICIENT_STOCK","message":"Sản phẩm không còn đủ số lượng","details":[{"field":"items[0]","code":"INSUFFICIENT_STOCK","message":"Số lượng yêu cầu vượt tồn khả dụng"}]}}

    {"eventId":"11111111-1111-4111-8111-111111111111","eventType":"OrderConfirmed","eventVersion":1,"aggregateId":"33333333-3333-4333-8333-333333333333","occurredAt":"2026-10-01T10:00:00Z","correlationId":"22222222-2222-4222-8222-222222222222","payload":{"orderId":"33333333-3333-4333-8333-333333333333"}}

## Gate

- Người 1 xuất CurrentActor/transaction/outbox/audit ports hoặc mock tương thích; các module tự giữ mock bên trong module mình.
- Contract test xác minh lỗi envelope, 401/403, transaction rollback, outbox không publish trước commit và consumer retry không tạo side effect trùng.
- Backend hiện chưa có NestJS bootstrap; contract là hành vi cần hiện thực, chưa phải tính năng đã chạy.
