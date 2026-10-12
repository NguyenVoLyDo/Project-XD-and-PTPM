# DropConnect

Nền tảng dropshipping B2B2C nội địa, kết nối khách hàng, người bán và nhà cung cấp. Repository được tổ chức theo monorepo với hai ứng dụng độc lập:

- `frontend/`: Next.js cho storefront và các portal theo vai trò.
- `backend/`: NestJS API, tác vụ nền và tích hợp hạ tầng.

Tài liệu nghiệp vụ, kiến trúc và sơ đồ nằm trong [docs](./docs/README.md).

## Yêu cầu cài đặt

- Git
- Node.js `22.x` (tối thiểu `20.9.0`)
- pnpm `10.34.5`

Kiểm tra phiên bản sau khi cài:

```powershell
node --version
pnpm --version
git --version
```

Nếu máy đã có Node.js nhưng chưa có pnpm, kích hoạt pnpm qua Corepack:

```powershell
corepack enable pnpm
corepack install -g pnpm@10.34.5
pnpm --version
```

Trong trường hợp Corepack không có quyền ghi vào thư mục cài Node.js, dùng shim tại thư mục người dùng:

```powershell
$shimDir = "$env:LOCALAPPDATA\corepack-bin"
New-Item -ItemType Directory -Force -Path $shimDir
corepack cache clean
corepack enable --install-directory $shimDir pnpm
corepack install -g pnpm@10.34.5
```

Thêm `$shimDir` vào biến môi trường `Path` của User, mở terminal mới, rồi chạy lại `pnpm --version`.

## Bắt đầu làm việc

```powershell
git clone <repository-url>
cd "Đồ án Xây dựng và PTPM"
pnpm install
```

`pnpm install` phải chạy tại thư mục gốc. Lệnh sẽ dùng `pnpm-lock.yaml` để mọi thành viên nhận đúng cùng phiên bản dependency.

Không commit các tệp bí mật hoặc dữ liệu chạy local. Các tệp đó đã được loại trừ qua `.gitignore`, bao gồm `.env`, `node_modules`, dữ liệu PostgreSQL/Redis/MinIO và file upload.

## Cấu trúc dự án

```text
.
|- frontend/                 # Next.js client
|  |- src/app/               # Route và portal theo vai trò
|  |- src/components/        # UI dùng lại
|  |- src/features/          # Logic theo nghiệp vụ
|  |- src/lib/               # Client, utility, cấu hình dùng chung
|  `- src/types/             # Kiểu dữ liệu FE
|- backend/                  # NestJS server
|  |- src/common/            # Auth, database, validation, audit...
|  |- src/modules/           # Module nghiệp vụ
|  |- database/              # Migration và seed
|  `- test/                  # Unit, integration, e2e test
`- docs/                     # BA, kiến trúc, quy tắc và Mermaid
```

Các thư mục hiện có `.gitkeep` chỉ để Git lưu cấu trúc ban đầu; có thể xóa khi thư mục đã chứa mã nguồn thực tế.

## Khởi tạo cơ sở dữ liệu

Dự án dùng PostgreSQL. File SQL dưới đây **xóa sạch database local `dropconnect` nếu đã tồn tại**, rồi tạo lại toàn bộ schema nền tảng. Chỉ dùng cho development/test, tuyệt đối không dùng trên môi trường có dữ liệu cần giữ.

1. Mở `backend/database/init.sql` và thay `change-me` bằng mật khẩu local riêng của bạn. Không commit mật khẩu này.
2. Cài và khởi động PostgreSQL 16 trở lên, sau đó chạy file bằng tài khoản quản trị PostgreSQL:

```powershell
psql -U postgres -d postgres -f backend/database/init.sql
```

File SQL tự tạo hoặc cập nhật user `dropconnect`, xóa database `dropconnect` cũ (nếu có), tạo lại database, extension và các bảng lõi. Mỗi lần chạy sẽ xóa toàn bộ dữ liệu cũ.

3. Tạo file cấu hình backend:

```powershell
Copy-Item backend/.env.example backend/.env
```

Cập nhật `DATABASE_URL` trong `backend/.env` bằng mật khẩu bạn đã đặt ở bước 1. Không commit file này.

Các bảng nghiệp vụ sẽ được bổ sung sau theo module dưới dạng file SQL versioned trong `backend/database/schema/`.

## Quy ước làm việc

1. Tạo branch riêng từ branch chung của nhóm.
2. Chạy `pnpm install` sau khi pull thay đổi có liên quan đến `package.json` hoặc `pnpm-lock.yaml`.
3. Không sửa trực tiếp lockfile bằng tay.
4. Không commit `.env`, khóa riêng, token, mật khẩu hoặc dữ liệu local.
5. Đọc tài liệu liên quan trong `docs/` trước khi triển khai module nghiệp vụ.

## Hướng dẫn chạy dự án

### Chạy đồng thời cả Frontend và Backend

Tại thư mục gốc của repository:

```powershell
# Chạy cả 2 ứng dụng song song
pnpm dev

# Hoặc chạy riêng từng ứng dụng trong 2 terminal:
pnpm dev:backend   # API NestJS chạy tại http://localhost:4000 (Health: http://localhost:4000/health)
pnpm dev:frontend  # Web Next.js chạy tại http://localhost:3000
```

### Chạy kiểm thử tự động (Unit / Business Rule Tests)

```powershell
pnpm test
```

## Tài khoản Demo có sẵn (Trải nghiệm nhanh bằng 1-Click)

Hệ thống đã nạp sẵn dữ liệu mẫu thực tế và thanh công cụ đổi vai trò (Role Switcher) ở góc trên màn hình:

1. **Khách hàng (Customer C):** `customer@gmail.com` (Mật khẩu: `123456`)
   - Mua giỏ hàng đa nguồn từ nhiều NCC.
   - Kiểm tra tách đơn con tự động, theo dõi mã vận đơn, hủy đơn hoặc gửi yêu cầu đổi trả / hoàn tiền.
2. **Người bán (Seller X - TechStore):** `sellerx@techstore.vn` (Mật khẩu: `123456`)
   - Mở gian hàng, kéo sản phẩm từ Catalog NCC để tạo Niêm yết bán lẻ (Listing).
   - Kiểm tra ràng buộc biên lợi nhuận `>= 10%`. Xem cảnh báo khi NCC tăng giá vốn làm Listing tạm dừng (`PAUSED_PRICE_MISMATCH`).
   - Theo dõi đơn hàng qua shop (dữ liệu PII của khách được làm mờ an toàn) và xem ví doanh thu.
3. **Nhà cung cấp A (Phụ Kiện Việt):** `suppliera@phukienviet.vn` (Mật khẩu: `123456`)
   - Quản lý sản phẩm nguồn, cập nhật giá vốn và tồn kho.
   - Tiếp nhận đơn thực hiện (Fulfillment Order): Chấp nhận đơn (Commit trừ kho), Đóng gói, Điền mã vận đơn, Xác nhận giao thành công.
4. **Nhà cung cấp B (Gia Dụng B&C):** `supplierb@giadungviet.vn` (Mật khẩu: `123456`)
   - Thử nghiệm tình huống từ chối đơn do hết hàng -> Hệ thống tự động kích hoạt hoàn tiền một phần cho khách hàng.
5. **Quản trị viên (Admin):** `admin@dropconnect.vn` (Mật khẩu: `123456`)
   - Dashboard theo dõi GMV, phí sàn 5%, tổng đơn và số lượng đối tác.
   - Phê duyệt hồ sơ KYC của Supplier và Seller.
   - Thẩm định khiếu nại tranh chấp đổi trả (Disputes) và duyệt hoàn tiền.
   - Quản lý sổ cái kế toán kép (`FinancialEntry`) và ra lệnh chi trả Payout.
   - Tra cứu Audit Log bất biến của toàn hệ thống.

