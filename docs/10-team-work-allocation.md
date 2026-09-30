# 10. Phân công triển khai cân bằng cho nhóm 4 người

Mỗi thành viên sở hữu các mảng chức năng trọn vẹn theo Bounded Context. Ranh giới được phân chia rõ ràng ở cả **Backend modules** (`backend/src/modules/`) và **Frontend route directories** (`frontend/src/app/`) để đảm bảo các thành viên làm việc song song 100% không bị xung đột git (Zero Merge Conflict).

## Quy ước chung

- Làm trên branch riêng: `feature/<module>-<mo-ta>`.
- Mỗi endpoint phải kiểm tra RBAC, ownership và ghi audit khi thay đổi trạng thái.
- VND lưu số nguyên (`integer`/`bigint`), không dùng `float`.
- Không ai sửa file trong thư mục route hoặc module của người khác. Khi cần tích hợp, sử dụng mock/adapter hoặc API contract đã thỏa thuận.
- Người sở hữu module chịu trách nhiệm test business rule, cập nhật API contract và UAT case của module đó.

---

## Bảng phân chia công việc chi tiết

| Thành viên | Backend Modules (`backend/src/modules/`) | Frontend Routes (`frontend/src/app/`) | Trách nhiệm chính & Bounded Context |
|---|---|---|---|
| **Người 1** *(Nền tảng & Quản trị)* | • `common`<br>• `identity`<br>• `admin`<br>• `notifications` | • `/admin/*`<br>• `/(public)/login`<br>• `/(public)/register`<br>• `/(public)/auth/*` | **Khung nền tảng, Xác thực & Quản trị hệ thống**<br>- Base framework, JWT, RBAC Guard, Password hashing.<br>- Admin portal: Quản lý user, duyệt/khóa hồ sơ Supplier & Seller, xem Audit log hệ thống.<br>- Hệ thống thông báo in-app / mock event. |
| **Người 2** *(Nguồn hàng & Kho gốc)* | • `catalog`<br>• `listings`<br>• `inventory` *(Trọn gói)* | • `/supplier/products/*`<br>• `/supplier/inventory/*`<br>• `/seller/shops/*`<br>• `/seller/listings/*` | **Nguồn hàng, Kênh bán & Quản lý kho**<br>- Supplier: CRUD Product, upload ảnh S3/MinIO, giá vốn, trạng thái.<br>- Seller: Quản lý Shop, kéo Product tạo Listing, định giá và kiểm tra biên lợi nhuận (margin).<br>- Tồn kho: Quản lý tồn gốc và cung cấp service atomics (`hold`, `commit`, `release`) cho Người 3 & Người 4. |
| **Người 3** *(Khách hàng & Bán hàng)* | • `cart`<br>• `orders` | • `/(public)/*` (Home, Category, Listing detail, Search)<br>• `/(customer)/cart`<br>• `/(customer)/checkout`<br>• `/(customer)/orders/*` | **Trải nghiệm mua sắm & Xử lý đơn hàng**<br>- Storefront công khai: Tìm kiếm, lọc, xem chi tiết listing.<br>- Giỏ hàng (Cart) & Luồng thanh toán (Checkout flow).<br>- Snapshot giá, kiểm tra idempotency.<br>- **Order Splitting**: Tách 1 đơn cha (`CustomerOrder`) thành $N$ đơn con (`FulfillmentOrder`) theo từng cặp Supplier – Seller. |
| **Người 4** *(Vận hành & Tài chính)* | • `fulfillment`<br>• `payments`<br>• `settlements`<br>• `disputes` | • `/supplier/orders/*`<br>• `/supplier/finance/*`<br>• `/seller/finance/*`<br>• `/customer/disputes/*` | **Vận hành đơn hàng, Logistics & Sổ cái tài chính**<br>- Thanh toán: Online mock / COD, webhook idempotent.<br>- Fulfillment: Supplier accept/reject đơn con, cập nhật vận đơn & tracking giao hàng.<br>- Sổ cái kế toán kép (`FinancialEntry`): Tính tiền gốc NCC, lãi Seller, phí sàn.<br>- Khiếu nại & Hoàn tiền: Quản lý vòng đời Dispute, trigger refund và đảo ngược hạch toán. |

---

## Chi tiết trách nhiệm & Nghiệm thu từng người

### Người 1 — Nền tảng, Quản trị & Xác thực
1. Thiết lập khung chung: Base DTO, exception filter, base repository, logger.
2. Đăng ký, đăng nhập, JWT access token + refresh token, RBAC Guard, Actor context (`userId`, `role`, `actorId`).
3. User profile, duyệt hồ sơ KYC của Supplier/Seller (Pending $\to$ Active $\to$ Suspended).
4. Admin Dashboard, Audit Log tập trung theo dõi mọi thay đổi trạng thái quan trọng.
5. In-app notifications & mock notification dispatch.

**Tiêu chí nghiệm thu:**
- Tài khoản chưa duyệt không thể publish Listing hoặc Product.
- Sai role hoặc không đúng ownership trả về đúng HTTP 403 Forbidden.
- Mọi thao tác phê duyệt/khóa tài khoản đều có log trong `AuditLog`.

---

### Người 2 — Nguồn hàng, Kênh bán & Quản lý tồn kho
1. **Catalog**: Supplier CRUD Product, ảnh sản phẩm (MinIO/S3), mô tả, thuộc tính, giá vốn.
2. **Listings**: Seller CRUD Shop; chọn Product từ Catalog để tạo Listing; định giá bán lẻ; kiểm tra ràng buộc biên lợi nhuận `giá bán >= giá vốn + minMargin`.
3. **Inventory (Trọn gói)**:
   - Quản lý số lượng tồn gốc của Supplier.
   - Viết API/Service nội bộ phục vụ Checkout & Fulfillment:
     - `holdStock(txContext, orderItemId, productId, quantity, expiresAt)`: Tạm giữ tồn kho khi checkout.
     - `commitStock(reservationId, sourceRef)`: Trừ tồn kho chính thức khi Supplier duyệt đơn.
     - `releaseStock(reservationId, sourceRef)`: Trả lại tồn kho khi hủy đơn hoặc hết hạn thanh toán.

**Tiêu chí nghiệm thu:**
- Supplier chỉ được sửa Product và tồn kho của chính mình.
- Hai Seller cùng bán 1 Product với giá khác nhau độc lập.
- Listing dưới margin hoặc Product hết tồn kho không được phép kích hoạt (Active).
- Không xảy ra race condition làm âm tồn kho khi nhiều request hold cùng lúc.

---

### Người 3 — Trải nghiệm mua sắm & Tạo đơn (Storefront & Orders)
1. **Storefront**: Trang chủ, danh mục, trang chi tiết Listing (ảnh, giá, thông tin shop), thanh tìm kiếm/bộ lọc.
2. **Cart & CartItem**: Thêm, sửa, xóa giỏ hàng; re-validate giá và tồn kho realtime.
3. **Checkout**:
   - Snapshot giá bán và thông tin sản phẩm tại thời điểm đặt hàng.
   - Gọi `InventoryService.holdStock` để tạm giữ tồn.
   - Bảo đảm Idempotency (chống đặt trùng đơn khi double-click).
4. **Order Management & Splitting**:
   - Tạo `CustomerOrder` (đơn tổng để khách thanh toán 1 lần).
   - Tự động tách thành các `FulfillmentOrder` (đơn con) phân nhóm theo cặp (supplierId, sellerId).

**Tiêu chí nghiệm thu:**
- Giỏ hàng gồm sản phẩm của 2 Supplier khác nhau tạo đúng 1 đơn cha và 2 đơn con riêng biệt.
- Request trùng idempotency key không tạo ra đơn hàng thứ hai.
- Payments job xử lý Online hết hạn 15 phút; Fulfillment job xử lý Supplier chưa xác nhận sau 24 giờ. Cả hai gọi releaseStock idempotent qua port.

---

### Người 4 — Vận hành đơn, Thanh toán & Tài chính (Logistics & Finance)
1. **Payments**: Cổng thanh toán mô phỏng (Online / COD), xử lý webhook idempotent, phân bổ `PaymentAllocation` về từng `FulfillmentOrder`.
2. **Fulfillment**: Supplier xem danh sách đơn con của mình; bấm Chấp nhận (`commitStock`) hoặc Từ chối (`releaseStock` + kích hoạt hoàn tiền một phần).
3. **Shipment & Tracking**: Cập nhật mã vận đơn, mô phỏng chuyển trạng thái (`READY_TO_SHIP` $\to$ `SHIPPED` $\to$ `DELIVERED`). Phát event để orders cập nhật fulfillmentSummary từ trạng thái các đơn con.
4. **Settlements & Ledger (Kế toán kép)**:
   - Ghi nhận `FinancialEntry` append-only: Tiền hàng gốc trả NCC, lợi nhuận chia Seller, phí hoa hồng sàn.
   - Giữ tiền trong thời hạn khiếu nại (Return Window - 7 ngày sau `DELIVERED`), sau đó chuyển sang `ELIGIBLE` để payout mock.
5. **Disputes & Refunds**: Khách yêu cầu trả hàng/hoàn tiền; xử lý bằng chứng; thực hiện hoàn tiền (`Payment.refund`) và đảo ngược bút toán kế toán tương ứng.

**Tiêu chí nghiệm thu:**
- Webhook thanh toán gọi lặp lại không tạo bản ghi thanh toán hay bút toán thứ hai.
- Supplier A từ chối đơn chỉ hoàn đúng số tiền của Supplier A, không ảnh hưởng đơn của Supplier B.
- Bút toán tài chính luôn cân bằng tổng Nợ = tổng Có.
- Tiền đối soát chỉ được phép rút sau khi đơn hoàn tất và hết hạn đổi trả.

---

## Hợp đồng bàn giao giữa các thành viên (Contracts)

| Bên cung cấp | Bên sử dụng | Hợp đồng giao tiếp (Interface / DTO) |
|---|---|---|
| **Người 1** | Người 2, 3, 4 | JWT Payload (`userId`, `role`, `actorId`); AuthGuard / RolesGuard; API Profile status |
| **Người 2** | Người 3 | Listing Active DTO (`listingId`, `productId`, `supplierId`, `sellerId`, `salePrice`, `stock`); Service `holdStock` |
| **Người 2** | Người 4 | Service `commitStock`, `releaseStock` |
| **Người 3** | Người 4 | Cấu trúc `CustomerOrder`, danh sách `FulfillmentOrder`, `OrderItemSnapshot`, `StockReservation` |
| **Người 4** | Người 1, 3 | Status event (`payment.succeeded`, `order.delivered`, `refund.completed`) để gửi notification và hiển thị cho Customer |
| **Người 1** | Người 4 | Quyết định Admin Dispute Approval: trigger lệnh hoàn tiền và ghi sổ cái |

---

## Thứ tự triển khai & Tích hợp

1. **Giai đoạn 1 (Khởi động song song)**:
   - Người 1: Khung base, Auth, JWT Guard, Database connection.
   - Người 2: CRUD Product, Shop, Listing, bảng tồn kho `inventory` (dùng mock user).
   - Người 3: UI Storefront, Cart (dùng mock listings).
   - Người 4: State machine Fulfillment & bảng kế toán `financial_entries` (dùng mock order).
2. **Giai đoạn 2 (Hoàn thiện nghiệp vụ nội bộ)**:
   - Mỗi người tự code và test trong ranh giới module và route của mình theo contract đã định.
3. **Giai đoạn 3 (Tích hợp & UAT End-to-End)**:
   - Bỏ adapter mock, kết nối API thật.
   - Chạy kịch bản UAT toàn diện: 2 Supplier, 1 Seller, 1 Customer; Khách mua giỏ hàng 2 món của 2 Supplier; Supplier A giao thành công, Supplier B từ chối $\to$ Kiểm tra trừ kho, giao hàng, hoàn tiền và đối soát ví tiền.
