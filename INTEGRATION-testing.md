# Tích hợp dev/trung vào testing — 02/11/2026

Nguồn merge: `8efa3bce4b5b9d311c788a5a46a21d726986b430`. Nền testing trước merge: `1259924`. Tích hợp theo `docs/11-parallel-development-contracts.md` và contracts Common, Identity, Admin, Notifications; giữ Cart/Orders và giao diện storefront hiện có.

## Thay đổi

- AppModule ghép Identity, Admin, Notifications với Catalog, Listings, Inventory, Cart và Orders. Identity xuất guard dùng chung; kiểm tra trạng thái user áp dụng cả cho Cart/Orders.
- Actor chuẩn giữ `userId`, `activeRole`, `activeProfileId`; guard bổ sung các trường tương thích cho controller nguồn hàng hiện có. Admin không tự vượt kiểm tra active role của Customer.
- Runtime tích hợp không chấp nhận token mock không có chữ ký hoặc header tự khai danh tính. DemoAppModule giữ harness dữ liệu demo độc lập, chỉ bật qua `DEMO_AUTH_ENABLED=true` ngoài production.
- Backend thống nhất cổng mặc định 4000, build CommonJS và chạy `dist/main.js`. JWT lấy cấu hình sau khi đọc môi trường, dùng một provider cho Identity và guards.
- Frontend thống nhất API base, access token và cách bóc response envelope. Storefront nhận actor đăng nhập thật; Admin kiểm tra phiên/role. Admin API không trả thành công giả khi request lỗi.
- Bootstrap SQL nạp schema Identity/Notifications sau các bảng phụ thuộc; kiểu audit schema khớp entity. Chưa chạy reset database.

## Kiểm tra

```powershell
pnpm.cmd test
pnpm.cmd build:backend
pnpm.cmd build:frontend
node backend/test/integration/identity-runtime.cjs --browser
node backend/test/integration/browser-smoke.cjs
```

Unit/contract/integration demo: 12 file, 124 test. Harness `identity-runtime.cjs` khởi tạo AppModule và HTTP/JWT thật với repository giả lập: login, me, cart, checkout, RBAC, từ chối header giả và khóa tài khoản giữa hai request. Browser harness kiểm tra đăng nhập trên mobile, khôi phục phiên khi tải trang và chặn Customer khỏi Admin. Browser smoke storefront kiểm tra catalog → cart → checkout → order detail, hai nhóm Supplier, desktop/mobile, validation, retry và không có page error.

## Chạy local và giới hạn

Đặt `DATABASE_URL` và `JWT_SECRET` trong `backend/.env`; chạy backend bằng `pnpm.cmd dev:backend` từ root để pnpm đặt đúng thư mục backend. Frontend mặc định dùng `http://localhost:4000/api/v1`; `NEXT_PUBLIC_API_URL` chấp nhận URL có hoặc không có `/api/v1`.

Chạy demo cũ không cần PostgreSQL:

```powershell
$env:DEMO_AUTH_ENABLED = 'true'
pnpm.cmd dev:backend
```

Bỏ biến demo để chạy AppModule có Identity/PostgreSQL. Runtime demo không cung cấp API đăng nhập/quản trị; đây là harness kiểm tra nghiệp vụ nguồn hàng và mua hàng.

PostgreSQL cổng 5432 từ chối kết nối; cổng 5433 hoạt động nhưng tài khoản mặc định bị lỗi xác thực 28P01. Cần cấu hình DB test riêng trước khi kiểm tra SQL, đăng ký/refresh/audit/notifications trên PostgreSQL. Không chạy `init.sql` trên DB chung vì script xóa và tạo lại database `dropconnect`.

Catalog/Inventory/Cart/Orders vẫn dùng StoreService và adapter giao dịch trong bộ nhớ; chưa phải lưu trữ PostgreSQL thống nhất. Chưa xác minh race/rollback DB, refresh-token rotation đồng thời, thu hồi access token ngay sau logout hoặc UAT toàn bộ Admin/Notifications. Việc ghép module và tests hiện tại không thay thế cổng nghiệm thu Pha B.

Theo yêu cầu người dùng, không push remote.
