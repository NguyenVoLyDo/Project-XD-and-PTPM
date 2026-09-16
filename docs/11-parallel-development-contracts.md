# 11. Quy tắc phát triển song song không chờ nhau

Mục tiêu: bốn người có thể làm và test phần mình ngay từ ngày đầu, không phải chờ API, database hay giao diện của người khác. Tích hợp chỉ diễn ra ở mốc cuối sau khi từng module đã đạt nghiệm thu nội bộ.

## 1. Ranh giới sở hữu bắt buộc

| Người | Chỉ được chủ động sửa |
|---|---|
| 1 | common, identity, admin, disputes, notifications, giao diện auth/admin |
| 2 | catalog, listings, giao diện supplier/seller/catalog |
| 3 | cart, orders, inventory reservation, giao diện public/customer/checkout |
| 4 | payments, fulfillment, settlements, giao diện vận hành đơn |

Không ai tự sửa module của người khác, init.sql, package root, cấu hình dùng chung hoặc API contract đã khóa. Thay đổi cần thiết được ghi issue/PR riêng và chỉ tích hợp ở mốc chung.

## 2. Contract trước, implementation sau

Mỗi module công bố một file contract trong docs/contracts/<module>.md trước khi code:

- Request/response DTO mẫu.
- Danh sách status, error code và quyền gọi.
- Event input/output của module.
- Ví dụ JSON thành công và thất bại.

Contract được dùng như interface tạm thời. Khi API thật chưa có, module gọi phải dùng adapter mock trả đúng JSON ví dụ, không gọi trực tiếp sang source code của module khác.

## 3. Cách làm độc lập cho từng người

| Người | Dữ liệu/adapter mock phải dùng | Không cần chờ |
|---|---|---|
| 1 | User/Profile/Audit in-memory hoặc seed riêng | Catalog, Order, Payment |
| 2 | CurrentActor mock và Supplier/Seller profile fixture | Auth API thật, Checkout |
| 3 | CatalogGateway mock, InventoryGateway mock, PaymentIntentGateway mock | Catalog API, Payment API, Fulfillment |
| 4 | OrderGateway mock, PaymentGateway mock, DisputeGateway mock | Checkout API, Admin dispute API |

Mock đặt trong chính feature/module của người sở hữu. Không đưa mock vào common để tránh conflict.

## 4. Database không chặn công việc

- init.sql chỉ là script reset local, do một người tích hợp được chỉ định quản lý.
- Mỗi người viết thay đổi bảng của mình thành file riêng: backend/database/schema/<so>-<owner>-<module>.sql.
- Không ai sửa trực tiếp init.sql trong lúc phát triển song song.
- Khi kết thúc một sprint, người tích hợp ghép các file SQL đã review vào init.sql và chạy reset database để kiểm tra tích hợp.
- Trước khi ghép, module có thể chạy bằng repository in-memory/mock; không được chờ database table của người khác.

## 5. Hai pha bắt buộc

### Pha A — Làm độc lập

Mỗi người hoàn thiện UI, service, validation, state transition và unit test bằng mock/fixture. PR chỉ chạm thư mục sở hữu của mình và contract docs của module mình.

### Pha B — Tích hợp

Chỉ sau khi bốn contract đã stable:

1. Thay adapter mock bằng HTTP client/repository thật.
2. Ghép SQL theo thứ tự dependency.
3. Chạy UAT đa Supplier và các test RBAC, idempotency, refund.
4. Sửa lỗi tích hợp qua PR nhỏ; không mở rộng tính năng trong pha này.

## 6. Tiêu chí hoàn thành độc lập

Một thành viên được coi là hoàn thành Pha A khi:

- Clone project và chạy test/module demo mà không cần service của người khác.
- Có fixture/mock cho toàn bộ dependency ngoài module.
- UI thể hiện được success, loading, empty và error state.
- Contract, status/error code và test case đã được ghi lại.
- PR không chạm file thuộc quyền sở hữu của người khác.

