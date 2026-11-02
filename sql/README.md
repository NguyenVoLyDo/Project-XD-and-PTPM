# BẢNG TÀI KHOẢN VÀ DỮ LIỆU TEST HỆ THỐNG (DROPCONNECT)

Tài liệu này cung cấp danh sách đầy đủ 12 tài khoản kiểm thử cho 4 Actor chính (Admin, Người bán, Người mua, Nhà cung cấp) và các dữ liệu mẫu đã được nạp trực tiếp vào cơ sở dữ liệu PostgreSQL.

---

## 1. THÔNG TIN ĐĂNG NHẬP CHUNG

* **Mật khẩu cho TẤT CẢ các tài khoản:** `123456789`
* **Thuật toán băm:** Argon2id (Chuẩn RFC 9106, tham số: `m=65536, t=3, p=1`)
* **File SQL mẫu:** [`sql/seed_test_data.sql`](seed_test_data.sql)

---

## 2. DANH SÁCH 12 TÀI KHOẢN CHO 4 ACTOR CHÍNH

### 👑 2.1. Quản trị viên (ADMIN) - 3 Tài khoản
Dùng để đăng nhập vào trang quản trị hệ thống (`/admin`), duyệt hồ sơ Seller/Supplier, xem báo cáo đối soát và quản lý chính sách sản phẩm:

| STT | Email đăng nhập | Mật khẩu | Tên / Vai trò chi tiết | Quyền hạn (Roles) |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `admin1@dropconnect.vn` | `123456789` | **Nguyễn Văn Admin** (Super Admin) | `ADMIN`, `CUSTOMER` |
| **2** | `admin2@dropconnect.vn` | `123456789` | **Lê Vận Hành** (Operations Admin) | `ADMIN`, `CUSTOMER` |
| **3** | `admin3@dropconnect.vn` | `123456789` | **Trần Kiểm Soát** (Audit & Dispute Admin) | `ADMIN`, `CUSTOMER` |

---

### 🏪 2.2. Người bán (SELLER) - 3 Tài khoản
Dùng để đăng nhập vào phân hệ Người bán (`/seller`), quản lý gian hàng (Shop), niêm yết sản phẩm từ kho Supplier (Listings), định giá bán và theo dõi hoa hồng:

| STT | Email đăng nhập | Mật khẩu | Tên gian hàng (Shop Name) | Lĩnh vực kinh doanh chính |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `seller1@dropconnect.vn` | `123456789` | **TechZone Official Shop** | Phụ kiện công nghệ, sạc cáp, tai nghe Baseus |
| **2** | `seller2@dropconnect.vn` | `123456789` | **EcoHome Living Shop** | Đồ gia dụng thông minh, bình giữ nhiệt Lock&Lock |
| **3** | `seller3@dropconnect.vn` | `123456789` | **UrbanStyle Shop** | Thời trang GenZ, balo laptop, áo thun Polo |

*Tất cả 3 Seller đều đã được duyệt hồ sơ (`approval_status = 'APPROVED'`) và Shop ở trạng thái hoạt động (`status = 'ACTIVE'`).*

---

### 🏭 2.3. Nhà cung cấp (SUPPLIER) - 3 Tài khoản
Dùng để đăng nhập vào phân hệ Nhà cung cấp (`/supplier`), tạo sản phẩm (Products), nhập giá gốc (Cost Price), quản lý tồn kho và xác nhận/giao các kiện hàng (FulfillmentOrders):

| STT | Email đăng nhập | Mật khẩu | Tên công ty / Pháp nhân | Kho hàng & Sản phẩm cung cấp |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `supplier1@dropconnect.vn` | `123456789` | **Công ty TNHH Phụ Kiện Số Việt Nam** | Củ sạc 65W GaN, Cáp 100W, Tai nghe Bowie, Chuột Silent |
| **2** | `supplier2@dropconnect.vn` | `123456789` | **Công ty CP Gia Dụng Tiện Ích Việt Đức** | Bình giữ nhiệt Lock&Lock, Máy xay mini, Nồi chiên không dầu |
| **3** | `supplier3@dropconnect.vn` | `123456789` | **Xưởng Sản Xuất May Mặc An Bình** | Balo laptop chống nước 15.6", Áo thun Polo Cotton Compact |

*Tất cả 3 Supplier đều đã được duyệt (`approval_status = 'APPROVED'`) và có tài khoản thanh toán đối soát.*

---

### 🛒 2.4. Khách mua hàng (CUSTOMER) - 3 Tài khoản
Dùng để đăng nhập vào Storefront công khai, thêm hàng vào giỏ (`/cart`), tiến hành đặt hàng (`/checkout`) và theo dõi đơn hàng (`/orders`):

| STT | Email đăng nhập | Mật khẩu | Tên khách hàng | Dữ liệu mẫu đã chuẩn bị sẵn |
| :---: | :--- | :---: | :--- | :--- |
| **1** | `customer1@dropconnect.vn` | `123456789` | **Nguyễn Hoàng Nam** (Khách VIP) | **Đã có sẵn 2 món trong giỏ hàng** (Củ sạc GaN 65W + 2 Bình Lock&Lock) để test Checkout ngay. |
| **2** | `customer2@dropconnect.vn` | `123456789` | **Trần Thảo Ly** (Khách thường) | **Đã có sẵn Đơn hàng mẫu chia 2 kiện** (`DC-ORD-SPLIT-001`, trạng thái `PROCESSING`) để test màn hình chi tiết đơn. |
| **3** | `customer3@dropconnect.vn` | `123456789` | **Phạm Quang Minh** (Khách mới) | **Đã có sẵn Đơn hàng COD hoàn thành** (`DC-ORD-COD-DELIVERED`, trạng thái `CONFIRMED`/`FULFILLED`). |

---

## 3. CÁC KỊCH BẢN KIỂM THỬ (TEST SCENARIOS) GỢI Ý

### Kịch bản 1: Mua giỏ hàng đa nhà cung cấp & Kiểm tra tách đơn (Order Splitting)
1. Đăng nhập tài khoản `customer1@dropconnect.vn` (mật khẩu `123456789`).
2. Vào trang `/cart`: Bạn sẽ thấy 2 sản phẩm thuộc 2 nhà cung cấp khác nhau (Supplier 1 & Supplier 2).
3. Bấm **Tiến hành đặt hàng** sang `/checkout`:
   - Điền thông tin giao hàng và chọn COD hoặc Online.
   - Bấm **Đặt hàng**.
4. Vào trang `/orders/[id]`: Bạn sẽ thấy hệ thống tự động tách thành **2 Kiện hàng riêng biệt** (Fulfillment Parcels) cho 2 nhà cung cấp.

### Kịch bản 2: Nhà cung cấp duyệt đơn & Cập nhật mã vận đơn
1. Đăng nhập tài khoản `supplier1@dropconnect.vn` (mật khẩu `123456789`).
2. Vào mục quản lý đơn giao hàng: Xác nhận kiện hàng (`FulfillmentAccepted`) hoặc từ chối (`FulfillmentRejected`).
3. Nhập mã vận đơn vận chuyển (`FulfillmentShipped`).
4. Đăng nhập lại Customer để thấy trạng thái tiến trình đơn hàng (OrderStepper) tự động đồng bộ thời gian thực!

### Kịch bản 3: Kiểm tra bảo mật phân quyền (Ownership Guard)
1. Dùng tài khoản `customer1@dropconnect.vn` truy cập URL đơn hàng của `customer2@dropconnect.vn` (`/orders/88888888-8888-4888-8888-111111111111`).
2. Hệ thống sẽ trả về mã lỗi **403 FORBIDDEN** và hiển thị màn hình thông báo bạn không có quyền xem đơn hàng của người khác (chống rò rỉ PII theo NFR-01).

---

## 4. CÁCH NẠP LẠI DỮ LIỆU MẪU KHI CẦN (RESET SEED)

Nếu bạn cần nạp lại dữ liệu mẫu vào PostgreSQL bất cứ lúc nào, bạn có thể thực hiện theo 1 trong 2 cách:

* **Cách 1 (Bằng lệnh Node.js):**
  ```bash
  node backend/database/seed_test_accounts.cjs
  ```
* **Cách 2 (Bằng công cụ quản trị PostgreSQL như psql/DBeaver/pgAdmin):**
  Mở và thực thi file [`sql/seed_test_data.sql`](seed_test_data.sql) trên database `dropconnect`.
