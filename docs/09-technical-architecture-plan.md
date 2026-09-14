# 9. Kế hoạch kiến trúc kỹ thuật và cấu trúc thư mục

Tài liệu này chốt hướng triển khai trước khi tạo mã nguồn. Nó kế thừa các
quy tắc nghiệp vụ, ERD và luồng xử lý trong các tài liệu 01–08.

## 9.1 Quyết định kiến trúc

MVP triển khai theo **modular monolith**: các miền nghiệp vụ được tách thành
module độc lập trong một API NestJS và cùng dùng PostgreSQL. Những tác vụ bất
đồng bộ chạy trong một worker riêng. Đây là ranh giới đủ rõ để có thể tách
thành dịch vụ sau này, đồng thời tránh độ phức tạp vận hành của microservice
cho đồ án.

```text
Next.js Web (storefront + portal theo role)
                 |
              REST / JWT
                 v
NestJS API (module theo bounded context) <--> PostgreSQL
                 |                                  |
                 +--> Redis / BullMQ <--> Worker ---+
                 |
                 +--> Object storage (ảnh sản phẩm)
                 +--> Payment / Carrier adapter (mock ở MVP)
```

### Phạm vi ứng dụng chạy

| Ứng dụng | Trách nhiệm |
|---|---|
| `apps/web` | Storefront cho Customer; Seller, Supplier và Admin portal qua route theo role. |
| `apps/api` | REST API, xác thực, nghiệp vụ đồng bộ, webhook và OpenAPI. |
| `apps/worker` | Consumer BullMQ: thông báo, hết hạn reservation, settlement/payout batch và retry tích hợp. |

Không tách bốn frontend độc lập ở MVP. Một web app dùng chung design system,
xác thực và type API; các khu vực `/seller`, `/supplier`, `/admin` được bảo vệ
bằng middleware và RBAC. Chỉ nên tách thành app riêng khi cần deploy hay đội
phát triển độc lập.

## 9.2 Stack đề xuất

| Lớp | Công nghệ | Lý do chọn |
|---|---|---|
| Monorepo/build | `pnpm` workspaces + Nx | Quản lý app/lib TypeScript, cache task và dependency graph. |
| Web | Next.js (App Router), React, TypeScript | Route theo role, SSR cho catalog công khai và UI portal trong cùng ứng dụng. |
| UI/client state | Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query | Xây UI nhất quán; validate form và cache dữ liệu REST rõ ràng. |
| API | Node.js LTS, NestJS, TypeScript, REST + OpenAPI | Phù hợp module, guard RBAC, validation, webhook và tài liệu API. |
| Xác thực | JWT access token ngắn hạn + refresh token trong cookie `HttpOnly`; Argon2id | Bảo vệ API và giảm rủi ro lộ token qua JavaScript. |
| CSDL | PostgreSQL + TypeORM migrations | Transaction, lock/cập nhật tồn nguyên tử và migration versioned. |
| Cache/queue | Redis + BullMQ | Job retry, outbox consumer, TTL reservation và notification. |
| Lưu tệp | S3-compatible storage; MinIO local, S3/R2 khi deploy | Ảnh product và bằng chứng return không nằm trong database. |
| Tích hợp ngoài | Adapter interface; mock payment/carrier trước | Giữ đúng contract webhook/tracking nhưng không phụ thuộc nhà cung cấp thật. |
| Kiểm thử | Vitest, Supertest, Playwright | Unit/domain, API integration và luồng UAT end-to-end. |
| Chất lượng/CI | ESLint, Prettier, Husky/lint-staged, GitHub Actions | Đồng nhất format và chặn lỗi trước merge. |
| Quan sát | Pino, request/correlation ID, audit log trong PostgreSQL | Truy vết state transition, webhook và tác động actor. |
| Local infra | Docker Compose | Chạy PostgreSQL, Redis và MinIO có thể lặp lại trên mọi máy. |

**Quy ước API:** REST dưới `/api/v1`, JSON `camelCase`, lỗi theo một envelope
duy nhất, request validate bằng DTO + Zod schema dùng chung khi phù hợp.
OpenAPI là hợp đồng công khai; client type được sinh từ spec thay vì tự định
nghĩa lại response ở nhiều nơi.

## 9.3 Cấu trúc repository mục tiêu

```text
.
├── apps/
│   ├── web/                         # Next.js: storefront và các portal
│   ├── api/                         # NestJS HTTP API + webhook endpoints
│   └── worker/                      # BullMQ consumers và scheduled jobs
├── libs/
│   ├── api-contracts/               # OpenAPI-generated types và API client
│   ├── domain/                      # Value object, enum, rule thuần TS dùng chung
│   ├── ui/                          # Component UI tái sử dụng cho web
│   ├── config/                      # Env schema, constants, feature flags
│   ├── testing/                     # Factory, fixture và test helpers
│   └── integrations/                # Payment/carrier/storage adapter contracts
├── database/
│   ├── migrations/                  # Migration TypeORM, chỉ có versioned files
│   ├── seeds/                       # Dataset UAT Supplier A/B, Seller X/Y, Customer C
│   └── scripts/                     # Chỉ script quản trị DB được kiểm soát
├── infra/
│   ├── docker/                      # Dockerfile API, worker, web
│   └── compose/                     # Docker Compose local
├── docs/                            # UML, ADR, API design và test/UAT plan
├── tools/                           # Generator/check script cấp repository
├── .github/workflows/               # CI
├── nx.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── compose.yaml
```

`libs/domain` chỉ chứa logic thuần và không import NestJS, TypeORM hay React.
Entity, repository và transaction vẫn thuộc backend để frontend không vô tình
phụ thuộc vào mô hình lưu trữ.

## 9.4 Cấu trúc chi tiết từng ứng dụng

### Quy ước tổ chức theo module (module-first)

Code được tổ chức theo **chức năng/nghiệp vụ trước**, không theo loại tệp kỹ
thuật ở cấp toàn ứng dụng. Vì vậy khi phát triển Login, một lập trình viên chủ
yếu chỉ cần làm việc trong module `identity` ở API và feature `auth` ở web.
Controller, use case, entity và repository của Login được đặt gần nhau thay vì
phân tán vào các thư mục `controllers`, `services`, `entities` dùng chung.

| Module | Phạm vi sở hữu |
|---|---|
| `identity` | Đăng ký, đăng nhập, refresh/revoke session, profile role, duyệt Supplier/Seller. |
| `catalog` | Product nguồn, category, ảnh, giá vốn và tồn kho hiển thị. |
| `listings` | Shop, Listing, giá bán và quy tắc publish của Seller. |
| `cart` | Cart và CartItem của Customer. |
| `inventory` | StockReservation và thao tác hold/commit/release tồn kho nguyên tử. |
| `orders` | Checkout, snapshot giá, CustomerOrder và tách FulfillmentOrder. |
| `fulfillment` | Supplier accept/reject, đóng gói, shipment, tracking và trạng thái giao. |
| `payments` | Payment intent, COD, webhook, refund và idempotency thanh toán. |
| `settlements` | Hold/eligible, tính doanh thu và payout batch. |
| `disputes` | Return request, evidence và quyết định tranh chấp. |
| `notifications` | In-app/email notification và outbox consumer. |
| `reviews` | Review sau khi giao hoàn tất. |
| `admin` | API tổng hợp cho moderation, dashboard và audit query; không sở hữu dữ liệu nghiệp vụ lõi. |

`common` chỉ chứa hạ tầng thật sự dùng chung (ví dụ JWT guard, exception
filter, transaction helper), không trở thành nơi chứa logic nghiệp vụ không
rõ chủ sở hữu. `libs/ui` và `libs/domain` cũng chỉ nhận code được dùng từ ít
nhất hai module; nếu chưa có nhu cầu dùng chung, code ở lại module sở hữu nó.

**Quy tắc phụ thuộc:** một module không import trực tiếp repository/entity nội
bộ của module khác. Nó gọi public application service/port mà module kia
export. Ví dụ `orders` yêu cầu `inventory` giữ tồn qua `InventoryService`,
thay vì tự thao tác bảng `stock_reservations`. Điều này giữ ranh giới rõ ràng,
giảm coupling và cho phép tách service sau này nếu cần.

Ví dụ phạm vi Login:

```text
apps/api/src/modules/identity/
├── api/                         # AuthController, LoginDto, RegisterDto
├── application/                 # LoginUseCase, RefreshSessionUseCase
├── domain/                      # User, Session, password/token policy
├── infrastructure/              # TypeORM repository, Argon2/JWT adapter
├── identity.module.ts
└── identity.spec.ts

apps/web/src/features/auth/
├── api/                         # login, logout, refresh API calls
├── components/                  # LoginForm, RegisterForm
├── hooks/
├── schemas/                     # Zod validation schema
└── types/
```

### `apps/api`

```text
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── auth/                        # guards, decorators, current actor
│   ├── database/                    # TypeORM config, transaction/outbox helpers
│   ├── errors/                      # exception filter và error codes
│   ├── http/                        # pagination, response/correlation ID
│   ├── audit/                       # audit writer và event metadata
│   └── validation/                  # pipes/DTO validation dùng chung
├── modules/
│   ├── identity/                    # user, role profile, approval, session
│   ├── catalog/                     # product, media, category, supplier stock
│   ├── listings/                    # shop, listing, publish policy
│   ├── cart/                        # cart và cart item
│   ├── inventory/                   # stock reservation: hold/commit/release
│   ├── orders/                      # checkout, price snapshot, split fulfillment
│   ├── fulfillment/                 # accept, shipment, tracking, return flow
│   ├── payments/                    # COD, payment intent, refund, webhook
│   ├── settlements/                 # calculation, hold, payout batch
│   ├── disputes/                    # return request, evidence, admin decision
│   ├── notifications/               # notification preferences và outbox events
│   ├── reviews/                     # review sau khi đơn hoàn tất
│   └── admin/                       # moderation/dashboard queries
└── health/                          # readiness/liveness
```

Mỗi module giữ cấu trúc nội bộ thống nhất:

```text
<module>/
├── api/                             # controller, DTO, presenter
├── application/                     # use case / command handler
├── domain/                          # entity, policy, domain event
├── infrastructure/                  # TypeORM repository, external adapter
├── <module>.module.ts
└── *.spec.ts
```

Checkout là orchestration thuộc `orders`, nhưng chỉ gọi API nội bộ của
`inventory`, `payments` và `fulfillment`; không truy cập repository của module
khác trực tiếp. Transaction tạo order, snapshot, reservation, fulfillment
order và outbox event phải nằm ở application layer của `orders`.

### `apps/worker`

```text
apps/worker/src/
├── main.ts
├── worker.module.ts
├── processors/
│   ├── outbox.processor.ts
│   ├── notification.processor.ts
│   ├── reservation-expiry.processor.ts
│   ├── settlement.processor.ts
│   └── payout.processor.ts
└── schedulers/
    ├── reservation-expiry.scheduler.ts
    └── settlement-eligibility.scheduler.ts
```

Worker dùng chung module/infrastructure backend qua library nội bộ được export
có chủ đích, không gọi HTTP trở lại API để xử lý nghiệp vụ.

### `apps/web`

```text
apps/web/src/
├── app/
│   ├── (public)/                    # home, catalog, product detail
│   ├── (customer)/                  # cart, checkout, my-orders, reviews
│   ├── seller/                      # shop, listings, fulfillment overview, finance
│   ├── supplier/                    # products, stock, fulfillment execution
│   ├── admin/                       # approvals, disputes, settlement, audit
│   └── api/                         # BFF/proxy endpoint thật sự cần thiết
├── components/
│   ├── common/
│   ├── catalog/
│   ├── checkout/
│   └── order/
├── features/                        # query, form, view model theo feature
├── lib/                             # api client, auth helper, formatters
├── hooks/
├── styles/
└── middleware.ts                    # route protection theo session/role
```

Không đặt business rule (ví dụ giá, quyền sở hữu, điều kiện trạng thái) trong
web. Giao diện chỉ hỗ trợ trải nghiệm; API là nơi thực thi chính sách cuối
cùng.

## 9.5 Lưu trữ và boundary dữ liệu

- PostgreSQL là nguồn dữ liệu giao dịch duy nhất. Các bảng tối thiểu bổ sung
  so với ERD là `stock_reservations`, `outbox_events`, `audit_logs`,
  `idempotency_keys`, `return_requests`, `payout_batches` và `media_assets`.
- Tiền dùng `numeric(19,4)` hoặc giá trị minor-unit nhất quán; không dùng
  `float`.
- Mọi migration là file bất biến trong `database/migrations`; không bật
  `synchronize` ngoài local prototype.
- `outbox_events` được ghi trong cùng transaction với state change; worker
  mới publish sang BullMQ sau commit.
- Payment và carrier webhook kiểm chữ ký, lưu raw metadata đã lọc dữ liệu nhạy
  cảm, rồi deduplicate qua provider event ID/transaction reference.

## 9.6 Tích hợp ngoài ở MVP

Tạo interface trong `libs/integrations` ngay từ đầu:

```text
payments/{payment-gateway.port.ts, mock-payment.adapter.ts}
carrier/{carrier.port.ts, mock-carrier.adapter.ts}
storage/{object-storage.port.ts, minio.adapter.ts}
notifications/{notification.port.ts, in-app.adapter.ts}
```

Adapter mock phải mô phỏng được tạo payment/shipment, webhook hợp lệ, callback
trùng lặp và lỗi có thể retry. Nhờ vậy các yêu cầu FR-05, FR-06 và NFR-04 được
kiểm thử mà không cần tài khoản cổng thanh toán hay hãng vận chuyển thật.

## 9.7 Thứ tự triển khai sau khi phê duyệt kế hoạch

1. Scaffold monorepo, Docker Compose, env schema, lint/test/CI và health check.
2. Chốt OpenAPI v1, error code, ADR và migration nền cho identity/catalog.
3. Làm Identity/RBAC, catalog, shop/listing và media.
4. Làm cart, inventory reservation và checkout atomic/tách fulfillment order.
5. Thêm payment mock + webhook idempotent, fulfillment/tracking mock.
6. Thêm cancel/return/refund, settlement/payout job, notification/audit.
7. Seed UAT, unit/integration/E2E theo FR-01…FR-08 và NFR-01…NFR-04.

## 9.8 Quyết định cần giữ nhất quán

- Không tạo microservice, Kafka, Kubernetes hay nhiều database trong MVP.
- Không tin giá, tồn kho, role hay state transition do client gửi lên.
- Không xóa lịch sử order/financial/audit; dùng status, event và bút toán điều
  chỉnh.
- Không kết nối trực tiếp payment/carrier thật trước khi test mock webhook,
  idempotency và retry hoàn tất.

## 9.9 Hợp đồng dữ liệu và quyết định triển khai BA

Các bảng dưới đây là phần bắt buộc của physical schema, bổ sung cho ERD lõi. Chúng không phải dữ liệu tùy chọn hay chỉ log kỹ thuật.

| Nhóm | Bảng/constraint tối thiểu | Mục đích |
|---|---|---|
| Đa vai trò | `user_role_memberships(user_id, role)` unique; profile theo role | Một User có thể đồng thời là Customer, Seller, Supplier; API xác thực active profile cho từng hành động. |
| Fulfillment | `fulfillment_items`, unique `(fulfillment_order_id, order_item_id)` | Phân bổ rõ dòng OrderItem cho một đơn con, không nối trực tiếp mơ hồ giữa hai aggregate. |
| Tồn kho | `stock_reservations(order_item_id, status, quantity, expires_at)`; unique active reservation theo order item | Hold/commit/release idempotent; không âm `on_hand - reserved`. |
| Thanh toán | `payment_intents`, `payment_attempts(provider, provider_event_id unique)`, `payment_allocations` | Tách ý định trả tiền, lần gọi provider và khoản phải thu của từng Fulfillment Order. |
| Hoàn và tài chính | `refunds`, append-only `financial_entries(source_type, source_id, entry_type)` | Hủy/hoàn một phần và payout luôn truy vết được, không update đè. |
| Vận hành | `outbox_events`, `idempotency_keys`, `audit_logs`, `return_requests`, `payout_batches` | Đảm bảo retry, audit và batch settlement an toàn. |

### Checkout transaction chuẩn

`OrdersApplicationService` tạo UUID cho OrderItem trước khi persist và mở một transaction chia sẻ với `InventoryService`. Trong transaction đó, truy vấn tồn phải có điều kiện tương đương `on_hand - reserved >= requestedQuantity`; không chỉ đọc tồn rồi mới update. Sau khi tạo order/items, fulfillment groups, reservation, payment intent/allocation và outbox, transaction commit. Adapter payment/carrier được gọi ngoài transaction.

`PaymentAttempt` lưu provider transaction reference; webhook được lưu/deduplicate theo provider event ID trước khi gọi application service. Nếu application service retry, unique constraint và FinancialEntry source reference là hàng rào cuối cùng chống side effect trùng.

### Tiền, PII và schema API

- MVP khóa `currency = VND`; API dùng integer amount và database dùng `bigint`/minor unit nhất quán. Khi cần đa tiền tệ, thêm currency scale/version thay vì đổi kiểu số cũ.
- `shippingAddressSnapshot` và thông tin người nhận thuộc CustomerOrder/FulfillmentOrder, không join động từ profile. DTO Supplier trả PII tối thiểu; DTO Seller chỉ trả trường đã mask.
- OpenAPI phải định nghĩa `Idempotency-Key`, error `IDEMPOTENCY_KEY_REUSED`, `SUPPLIER_TIMEOUT`, `LISTING_PAUSED_BY_POLICY` và lỗi item-level `INSUFFICIENT_STOCK`.
- Migration phải đặt unique/foreign key/check constraint cho các quy tắc nêu trên; domain service không phải là cơ chế bảo vệ duy nhất.

### Quy tắc đồng bộ tài liệu

File `.mmd` là source diagram được render; Markdown diễn giải và/hoặc nhúng đúng nội dung source đó. Mỗi thay đổi diagram phải sửa cả hai nơi trong cùng commit và CI cần render toàn bộ `docs/mermaid/*.mmd` trước khi merge. Điều này ngăn workflow nhúng và file Mermaid độc lập bị lệch nhau.
