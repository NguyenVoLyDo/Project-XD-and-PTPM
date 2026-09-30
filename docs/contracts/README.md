# DropConnect — baseline contract v1.0 cho nhóm 4 người

**Trạng thái:** baseline để bắt đầu Pha A bằng mock/fixture. Người dùng đã yêu cầu chốt nội dung kỹ thuật; tài liệu này không chứng minh bốn thành viên đã đọc hoặc đồng ý. Chủ module cần review PR trước khi coi là hợp đồng tích hợp cuối cùng. Chưa có API/boilerplate chạy thật trong repo.

## Một file cho mỗi module

| Người | File module | Ranh giới |
|---|---|---|
| 1 | common.md, identity.md, admin.md, notifications.md | Platform, actor, quyết định quản trị, thông báo |
| 2 | catalog.md, listings.md, inventory.md | Product, Listing, tồn và reservation |
| 3 | cart.md, orders.md | Cart, checkout, snapshot, order/projection |
| 4 | fulfillment.md, payments.md, settlements.md, disputes.md | Vận hành đơn con, thanh toán, đối soát, trả hàng |

Checkout là use case của orders. Reviews trong docs/09 chưa được phân công ở docs/10–11 nên chưa nằm trong baseline MVP của nhóm; cần phân công riêng trước khi code reviews.

## Quyết định chung đã chốt cho baseline

1. **Đường dẫn hiện tại:** frontend/ và backend/. apps/* trong docs/09 là mục tiêu kiến trúc, chưa phải checkout đang tồn tại.
2. **API:** prefix /api/v1, JSON camelCase, UUID string, timestamp ISO 8601 UTC; error envelope và HTTP status ở common.md. Các path trong file module là baseline v1, thay đổi cần cập nhật OpenAPI và mock.
3. **Identity:** CurrentActor = {userId, activeRole, activeProfileId}; actorId audit = userId. Customer profileId = null; Supplier/Seller phải có profile APPROVED và đúng ownership. API trả 403 khi truy cập tài nguyên thuộc người khác theo NFR-01.
4. **Tiền:** VND số nguyên ở API và mục tiêu DB bigint; không dùng float. init.sql hiện numeric(14,2), cần migration/mapper trước tích hợp DB. MVP fixture phí ship, discount, platformFee và sellerShippingShare = 0; các trường allocation vẫn phải có và lưu snapshot. grandTotal là tổng ban đầu bất biến; totalPayable là nghĩa vụ còn hiệu lực, chỉ đổi cùng transaction void/refund allocation. Amount snapshot của từng allocation không bị ghi đè.
5. **Listing:** dùng PAUSED_BY_POLICY. Margin tối thiểu là khoản VND minMargin: salePrice >= costPrice + minMargin. Ngưỡng minMargin là cấu hình platform, mặc định 0 cho mock; thay đổi cần policy version/test. Product và Listing phải ACTIVE, Supplier/Seller APPROVED, Shop ACTIVE.
6. **Cart/checkout:** chỉ Customer đã đăng nhập. Khi giá đổi giữa Cart và Checkout, trả 409 PRICE_CHANGED với giá hiện hành và yêu cầu Customer xác nhận lại; không âm thầm thanh toán giá mới. Checkout split theo (supplierId, sellerId), snapshot giá/tên/địa chỉ. Idempotency-Key theo (customerId,key), hash body chuẩn hóa; replay cùng body trả response đã lưu trước khi đọc Cart hiện tại.
7. **Transaction:** Orders mở một PostgreSQL transaction qua common. Listings đọc quote hợp lệ, Inventory hold, Fulfillment tạo đơn con, Payments tạo intent/payment/allocation, Orders ghi order/idempotency/outbox trong transaction đó. Không gọi provider/notification trong transaction. Mỗi module sở hữu bảng/logic của mình qua port; không import repository/entity nội bộ của nhau.
8. **Trạng thái:** CustomerOrder.status quản lý checkout/payment (PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, PROCESSING, CANCELED, CLOSED); fulfillmentSummary là projection đơn con và chứa PARTIALLY_CANCELED. Không dùng PARTIALLY_CANCELED như CustomerOrder.status. Payment status độc lập.
9. **SLA/job:** Payments sở hữu job Online pending 15 phút; Fulfillment sở hữu job Supplier accept 24 giờ và ship warning 48 giờ; Disputes sở hữu job phản hồi 48 giờ/gửi trả 72 giờ; Settlements sở hữu job hết return window 7 ngày. Worker host do Người 1 tích hợp, logic/job idempotency nằm ở module owner.
10. **Event:** envelope v1 ở common.md, tên PascalCase theo docs/06. Producer ghi outbox trong transaction; notifications consumer deduplicate theo eventId. PII không được phát broadcast.
11. **Schema:** init.sql là reset local, chưa phải migration đáp ứng đầy đủ baseline. Trước Pha B phải bổ sung shippingAddressSnapshot, bigint VND, unique active reservation per OrderItem, mô hình onHand/reserved của Inventory, provider event dedup, return_requests, payout_batches, deliveryAttemptCount và ledger transactionGroupRef/accountCode/direction để kiểm bút toán kép. Không sửa init.sql trong Pha A song song.

## Cách dùng để bắt đầu code

- Mỗi người tạo mock của dependency trong module mình theo JSON/port trong file contract tương ứng. Chủ module chỉ sửa file của mình; thay đổi ranh giới cần PR nhỏ, cập nhật producer + consumer mock + OpenAPI + test.
- Pha A nghiệm thu bằng module/unit/API mock tests. Pha B chỉ bắt đầu khi chủ module và bên dùng đã review các interface và schema/migration đã qua kiểm tra. Không gọi bản mock là tích hợp thật.
- Ví dụ JSON là fixture, không phải bằng chứng code đã tồn tại. OpenAPI được tạo/đồng bộ khi bootstrap API sẵn sàng.

## Gate trước tích hợp

1. Người 1 xuất common transaction/actor/outbox ports và error envelope.
2. Người 2 xác nhận quote Listing và Inventory hold/commit/release cùng transaction.
3. Người 3 xác nhận Orders/Checkout DTO, idempotency, split và projection.
4. Người 4 xác nhận Payment/Fulfillment/Refund/Settlement/Dispute event và port.
5. Người tích hợp review migrations, race/idempotency/PII UAT và xác nhận lại contract v1 trong PR. Sự xác nhận của từng thành viên cần ghi bằng review; tài liệu này không thay thế việc đó.

**Nguồn:** docs/03–11 và backend/database/init.sql. Khi một mô tả cũ mâu thuẫn với baseline này, cập nhật tài liệu cũ trong cùng thay đổi; không để hai định nghĩa tồn tại song song.
