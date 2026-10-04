# Báo cáo hiểu biết về dự án và công việc — Phạm Kiên Trung

**Thành viên:** Phạm Kiên Trung - Thành viên 1 (Nền tảng & Quản trị)

**Phần phụ trách:** Khung nền tảng, Xác thực & Quản trị hệ thống trong dự án DropConnect.

---

## 1. Tôi hiểu dự án như thế nào

DropConnect là nền tảng dropshipping nội địa kết nối ba bên: nhà cung cấp (Supplier) có sản phẩm và quản lý tồn kho; người bán (Seller) chọn sản phẩm để đăng bán trên gian hàng với giá riêng; khách hàng (Customer) tìm kiếm, mua và theo dõi đơn. Quản trị viên (Admin) phụ trách duyệt tài khoản, giám sát và xử lý các tình huống cần can thiệp. Mục tiêu là giúp người bán kinh doanh mà không phải tự nhập và lưu kho, đồng thời giúp nhà cung cấp nhận đơn từ nhiều gian hàng trong một quy trình rõ ràng.

Dưới góc nhìn của người phụ trách **Nền tảng & Quản trị**, DropConnect là một hệ thống phân tán đa vai trò (Multi-role / Multi-tenancy logic) với nhiều luồng nghiệp vụ đan xen giữa các chủ thể. Điểm cốt lõi đảm bảo hệ thống vận hành an toàn, nhất quán và mở rộng được nằm ở:
1. **Khung nền tảng dùng chung (`common`):** Định hình tiêu chuẩn kỹ thuật cho toàn bộ dự án — cấu trúc phản hồi API đồng nhất, cơ chế bắt và xử lý ngoại lệ tập trung (Global Exception Handling), nhật ký hệ thống (Request Logging / Tracing) và tiện ích mã hóa mật khẩu an toàn.
2. **Cơ chế Xác thực & Phân quyền (`identity`):** Là "cánh cổng an ninh" của hệ thống. Phải xác định chính xác danh tính người dùng qua JWT, bảo vệ mật khẩu bằng thuật toán băm (password hashing), và thực thi kiểm soát truy cập dựa trên vai trò (RBAC Guard) một cách nghiêm ngặt. Đảm bảo dữ liệu giữa các bên được cô lập tuyệt đối (Data Isolation) — không để xảy ra việc vượt quyền hay truy cập chéo tài nguyên.
3. **Cổng quản trị trung tâm (`admin`):** Đảm bảo an toàn vận hành bằng cách kiểm soát vòng đời tài khoản (xét duyệt hồ sơ pháp lý/kho của Supplier và gian hàng của Seller trước khi cho phép hoạt động), xử lý khóa tài khoản vi phạm, đồng thời lưu vết toàn bộ hoạt động nhạy cảm qua Audit Log.
4. **Hệ thống thông báo (`notifications`):** Đóng vai trò cầu nối thông tin, tiếp nhận các sự kiện hệ thống (tài khoản được duyệt, đơn hàng phát sinh, cảnh báo) để tạo thông báo in-app hoặc bắn mock event cho người dùng.

---

## 2. Công việc tôi phụ trách

| Mảng | Công việc và kết quả cần có |
| :--- | :--- |
| **Giao diện Xác thực & Công khai** | Xây dựng các trang công khai phục vụ xác thực: Đăng nhập (`/(public)/login`), Đăng ký theo từng vai trò (`/(public)/register`), và các luồng kích hoạt / xác thực / quên mật khẩu (`/(public)/auth/*`). |
| **Giao diện Quản trị (Admin Portal)** | Xây dựng toàn bộ giao diện dashboard và chức năng quản trị cho Admin (`/admin/*`): Quản lý danh sách người dùng, giao diện xét duyệt hồ sơ Supplier & Seller, chức năng tạm khóa/mở khóa tài khoản, xem và tra cứu Audit log hệ thống. |
| **`common` (Khung nền tảng)** | Cung cấp bộ khung base framework: Chuẩn hóa Response DTO (Success/Error), Global Exception Filter / Error Handler, Request Logging Middleware (Correlation ID), thuật toán băm mật khẩu (bcrypt/argon2). |
| **`identity` (Xác thực & Định danh)** | Xử lý logic đăng ký, đăng nhập, cấp phát và xác minh Access Token / Refresh Token (JWT); xây dựng các RBAC Guard, Decorator (`@Roles()`, `@CurrentUser()`); quản lý trạng thái tài khoản (`PENDING_APPROVAL`, `ACTIVE`, `LOCKED`). |
| **`admin` (Quản trị hệ thống)** | Cung cấp các API quản trị nội bộ: Phân trang, tìm kiếm và lọc danh sách người dùng; duyệt hoặc từ chối hồ sơ Supplier & Seller; khóa / mở khóa tài khoản; ghi nhận và truy xuất nhật ký kiểm toán (Audit Log). |
| **`notifications` (Hệ thống thông báo)** | Xây dựng dịch vụ lưu trữ thông báo in-app; API xem danh sách thông báo và đánh dấu đã đọc; cơ chế dispatch thông báo / mock event khi có sự kiện hệ thống. |
| **Chất lượng và bàn giao** | Viết API contract (Swagger/OpenAPI), chuẩn bị Mock/Fixture về Auth Token & User Context cho từng vai trò để các thành viên khác tích hợp; viết Unit Test & Integration Test cho Auth Guard, RBAC, luồng băm mật khẩu và cơ chế Audit Log. |

**Phạm vi mã nguồn của tôi:**
- **Backend:** `backend/src/modules/common`, `backend/src/modules/identity`, `backend/src/modules/admin`, `backend/src/modules/notifications`.
- **Frontend:** Các route `frontend/src/app/(public)/login`, `frontend/src/app/(public)/register`, `frontend/src/app/(public)/auth/*`, `frontend/src/app/admin/*`.
- Tôi chịu trách nhiệm bảo vệ "cổng vào" và cung cấp hạ tầng bảo mật/nền tảng chung cho toàn hệ thống; tôi không can thiệp trực tiếp vào dữ liệu hoặc quy tắc nội bộ thuộc module của các thành viên khác (Nguồn hàng/Kho của Thành viên 2, Giỏ hàng/Đơn hàng của Thành viên 3, hay Thanh toán/Giao vận của Thành viên 4).

---

## 3. Cách tôi hiểu luồng xác thực, phân quyền và quản trị hệ thống

1. **Đăng ký tài khoản và phân luồng trạng thái:**
   - Người dùng đăng ký tài khoản với vai trò tương ứng (`CUSTOMER`, `SELLER`, `SUPPLIER`). Mật khẩu bắt buộc phải được băm an toàn bằng thuật toán mạnh (bcrypt với salt rounds thích hợp hoặc argon2) trước khi lưu vào database, tuyệt đối không lưu plain text.
   - Tài khoản `CUSTOMER` sau khi đăng ký có thể được kích hoạt ngay (`ACTIVE`) để bắt đầu mua sắm.
   - Tài khoản `SELLER` và `SUPPLIER` sau khi đăng ký sẽ ở trạng thái chờ duyệt (`PENDING_APPROVAL`). Trong trạng thái này, họ chưa thể tạo sản phẩm, mở kho hay đăng bán Listing cho đến khi được Admin phê duyệt.

2. **Đăng nhập và quản trị vòng đời Token (JWT):**
   - Khi người dùng gửi credentials hợp lệ, hệ thống cấp phát cặp token: **Access Token** (thời hạn ngắn, mang claims: `userId`, `role`, `status`) và **Refresh Token** (thời hạn dài hơn, được lưu trữ và băm an toàn trong DB để chống đánh cắp).
   - Hỗ trợ cơ chế Refresh Token Rotation để cấp mới Access Token mà người dùng không cần đăng nhập lại; thu hồi (revoke) token ngay lập tức khi người dùng đăng xuất.

3. **Bảo vệ tài nguyên với RBAC Guard và Decorator:**
   - Mọi request gửi đến các endpoint nội bộ/bảo vệ đều phải đi qua `AuthGuard` để verify chữ ký và hạn dùng của JWT, trích xuất dữ liệu gắn vào `req.user`.
   - `RolesGuard` đối chiếu vai trò người dùng với metadata khai báo trên Controller/Route (`@Roles('SUPPLIER')`, `@Roles('ADMIN')`,...). Nếu không khớp, từ chối với mã `403 FORBIDDEN`.
   - Kiểm tra trạng thái tài khoản: Nếu tài khoản đang ở trạng thái `LOCKED` hoặc `PENDING_APPROVAL`, Guard sẽ lập tức chặn truy cập vào các nghiệp vụ kinh doanh tương ứng.

4. **Quy trình Quản trị Admin và Ghi nhận Audit Log:**
   - Admin truy cập Portal (`/admin/*`) để kiểm tra danh sách hồ sơ Supplier và Seller đang chờ duyệt. Admin có thẩm quyền Duyệt (`APPROVE`) hoặc Từ chối (`REJECT`) kèm lý do. Khi được duyệt, trạng thái tài khoản chuyển thành `ACTIVE`.
   - Admin có quyền khóa (`LOCK`) tài khoản nếu phát hiện gian lận hoặc vi phạm chính sách nền tảng.
   - **Tính toàn vẹn của Audit Log:** Mọi hành vi quản trị nhạy cảm (duyệt hồ sơ, đổi vai trò, khóa/mở khóa tài khoản) đều được hệ thống tự động ghi lại vào bảng `audit_logs` gồm: `adminId`, `action`, `targetType`, `targetId`, `timestamp`, `ipAddress` và snapshot dữ liệu thay đổi (`before`/`after`). Bản ghi Audit Log là bất biến (Append-only).

5. **Luồng phát sinh Thông báo (Notifications):**
   - Khi có sự kiện quan trọng (Admin duyệt/khóa hồ sơ, phát sinh đơn hàng mới, thay đổi trạng thái), module `notifications` ghi nhận bản ghi thông báo in-app để người dùng xem trong trang cá nhân/chuông thông báo, đồng thời phát sinh mock event phục vụ luồng thời gian thực.

---

## 4. Phối hợp với các thành viên khác

- **Thành viên 2 (Nguồn hàng & Kho gốc):**
  - Cung cấp `AuthGuard` và Decorator `@CurrentUser()` để Thành viên 2 trích xuất chính xác `supplierId` hoặc `sellerId`. Nhờ đó, Thành viên 2 dễ dàng thực hiện cô lập dữ liệu (Supplier A không can thiệp được sản phẩm/kho của Supplier B, Seller A không sửa được Shop/Listing của Seller B).
  - Cung cấp trạng thái duyệt hồ sơ để chặn các tài khoản Seller/Supplier chưa được duyệt (`PENDING_APPROVAL`) không cho tạo sản phẩm hoặc gian hàng.
- **Thành viên 3 (Trải nghiệm khách hàng, Giỏ hàng & Đơn hàng):**
  - Cung cấp cơ chế xác thực JWT cho Customer, bảo vệ các endpoint Giỏ hàng (`Cart`) và Đơn hàng (`Orders`) theo đúng `customerId`.
  - Cung cấp thông tin hồ sơ cơ bản (họ tên, email, số điện thoại) để hỗ trợ Thành viên 3 tự động điền (autofill) thông tin giao hàng tại màn hình Checkout.
- **Thành viên 4 (Thanh toán & Xử lý đơn hàng):**
  - Cung cấp cơ chế xác thực và bảo vệ các route xử lý thanh toán, webhook xác nhận giao hàng và hoàn tiền.
  - Phối hợp thông qua module `notifications` để tiếp nhận các sự kiện cập nhật trạng thái đơn hàng (đã thanh toán, đang giao, đã hủy) và hiển thị thông báo in-app cho khách hàng và đối tác.
- **Đóng góp về nền tảng chung:**
  - Thống nhất bộ khung `common`: Chuẩn hóa cấu trúc trả về của API (`{ success, data, error, timestamp }`), Global Exception Filter với danh mục mã lỗi chuẩn hóa (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, v.v.).
  - Cung cấp Mock Auth Token và Fixture cố định cho từng vai trò (`MOCK_CUSTOMER_TOKEN`, `MOCK_SELLER_TOKEN`, `MOCK_SUPPLIER_TOKEN`, `MOCK_ADMIN_TOKEN`) để các thành viên phát triển và kiểm thử độc lập mà không bị gián đoạn hay phụ thuộc vào DB thật trong giai đoạn đầu.

---

## 5. Tiêu chí tôi dùng để tự kiểm tra phần việc

1. **Bảo mật xác thực & Quản lý Token:**
   - Mật khẩu 100% được mã hóa bằng bcrypt/argon2 trước khi ghi vào cơ sở dữ liệu; không có kẽ hở nào làm rò rỉ mật khẩu gốc ra log hoặc response.
   - Token hết hạn, sai chữ ký bí mật (secret key) hoặc bị chỉnh sửa payload đều bị từ chối với mã lỗi `401 Unauthorized`. Luồng Refresh Token hoạt động trơn tru và chặn đứng token cũ đã bị thu hồi.
2. **Độ tin cậy của RBAC Guard:**
   - Không người dùng nào có thể vượt quyền truy cập (ví dụ: Customer/Seller không thể truy cập bất kỳ route nào thuộc `/admin/*`; Customer không thể gọi API dành riêng cho Supplier/Seller).
   - Tài khoản bị khóa (`LOCKED`) hoặc chưa được phê duyệt (`PENDING_APPROVAL`) lập tức bị từ chối truy cập vào các tài nguyên nghiệp vụ được bảo vệ.
3. **Toàn vẹn quy trình Admin & Audit Log:**
   - Trạng thái tài khoản chuyển đổi chính xác ngay sau khi Admin duyệt hoặc khóa hồ sơ.
   - 100% các thao tác nhạy cảm của Admin được ghi nhận đầy đủ vào Audit Log, không thể bị xóa hoặc sửa đổi từ giao diện người dùng.
4. **Chuẩn hóa nền tảng (`common`):**
   - Mọi API endpoint khi gặp ngoại lệ (kể cả lỗi không lường trước) đều được Global Exception Filter bắt lại và trả về định dạng JSON thống nhất, không bao giờ lộ stack trace hoặc thông tin nhạy cảm của hệ thống ra ngoài môi trường production.
5. **Trải nghiệm giao diện (UX/UI):**
   - Các màn hình đăng nhập, đăng ký và portal Admin có đầy đủ client-side validation (kiểm tra định dạng email, độ dài mật khẩu, bắt buộc nhập);
   - Thể hiện trực quan các trạng thái: Đang tải (loading spinner), thông báo lỗi rõ ràng (sai tài khoản/mật khẩu, tài khoản chờ duyệt, tài khoản bị khóa), cùng với bảng danh sách người dùng và audit log hỗ trợ phân trang, tìm kiếm và lọc dữ liệu mượt mà.
