# Báo cáo hiểu biết về dự án và công việc — Bùi Trường Quyên

**Thành viên:** Bùi Trường Quyên (thành viên 2)

**Phần phụ trách:** Quản lý sản phẩm nguồn, niêm yết gian hàng và tồn kho trong dự án DropConnect.

## 1. Tôi hiểu dự án như thế nào

DropConnect là nền tảng dropshipping nội địa kết nối ba bên: nhà cung cấp (Supplier) sở hữu hàng hóa và quản lý tồn kho; người bán (Seller) chọn sản phẩm nguồn để tạo niêm yết trên gian hàng của mình với giá bán riêng; khách hàng (Customer) tìm kiếm, mua và theo dõi đơn hàng. Quản trị viên (Admin) duyệt tài khoản, giám sát và xử lý các tình huống cần can thiệp. Mục tiêu là giúp người bán kinh doanh mà không phải tự nhập và lưu kho, đồng thời giúp nhà cung cấp mở rộng kênh phân phối theo quy trình có cấu trúc.

Theo tôi, nền tảng của toàn bộ hệ thống nằm ở dữ liệu sản phẩm và tồn kho. Mọi luồng nghiệp vụ đều phụ thuộc vào thông tin Product do Supplier quản lý và Listing mà Seller tạo ra từ đó. Quan trọng hơn, khi nhiều khách có thể checkout đồng thời, hệ thống phải đảm bảo tồn kho không bao giờ bị âm — việc giữ, chốt và nhả tồn phải là các thao tác nguyên tử, có thể kiểm thử và không để xảy ra bán vượt tồn.

## 2. Công việc tôi phụ trách

| Mảng | Công việc và kết quả cần có |
|---|---|
| Giao diện Supplier | Xây dựng trang quản lý sản phẩm nguồn (danh sách, tạo, chỉnh sửa, xem chi tiết Product); trang quản lý tồn kho và lịch sử biến động tồn. |
| Giao diện Seller | Xây dựng trang duyệt catalog, tạo và quản lý Listing trên gian hàng (giá bán, trạng thái, liên kết sản phẩm nguồn). |
| `catalog` | Supplier quản lý Product: tạo, cập nhật thông tin, giá vốn và hình ảnh; Admin duyệt/từ chối Product; cung cấp dữ liệu Product cho Seller và các module khác qua cổng giao tiếp công khai. |
| `listings` | Seller tạo Listing từ Product nguồn với giá bán riêng; quản lý trạng thái Listing (active, paused, archived); tự động tạm dừng Listing khi giá vốn tăng khiến biên lợi nhuận không còn đạt tối thiểu và thông báo Seller. |
| `inventory` | Quản lý số lượng tồn kho theo từng Product; thực hiện các thao tác reserve (giữ tồn khi checkout), commit (chốt tồn khi Supplier chấp nhận đơn) và release (nhả tồn khi hủy/lỗi/từ chối); đảm bảo không âm tồn trong môi trường nhiều yêu cầu đồng thời. |
| Chất lượng và bàn giao | Viết contract, mock/fixture và kiểm thử cho các luồng thuộc phần mình; phối hợp tích hợp với Identity, Orders/Cart và Fulfillment/Payments theo cổng giao tiếp đã thống nhất. |

Phạm vi mã nguồn của tôi là `backend/src/modules/catalog`, `backend/src/modules/listings`, `backend/src/modules/inventory` và các route `frontend/src/app/supplier/products/*`, `frontend/src/app/supplier/inventory/*`, `frontend/src/app/seller/catalog/*`, `frontend/src/app/seller/listings/*`. Tôi không thay đổi trực tiếp dữ liệu hoặc quy tắc nội bộ của module do thành viên khác sở hữu.

## 3. Cách tôi hiểu luồng quản lý sản phẩm và tồn kho

1. Supplier tạo Product với thông tin đầy đủ: tên, mô tả, hình ảnh, giá vốn và số lượng tồn kho ban đầu. Admin duyệt Product trước khi nó hiển thị trong catalog cho Seller.
2. Seller duyệt catalog, chọn Product phù hợp và tạo Listing với giá bán riêng. Listing thuộc về Shop của Seller và có vòng đời độc lập so với Product nguồn.
3. Khi Supplier cập nhật giá vốn, hệ thống kiểm tra lại biên lợi nhuận tối thiểu của tất cả Listing liên kết. Nếu Listing nào không còn đạt biên, hệ thống tự động tạm dừng Listing đó, ghi audit và thông báo Seller; giá của các OrderItem lịch sử không bị thay đổi.
4. Khi Orders gọi inventory.reserve(productId, quantity) trong luồng checkout, Inventory giảm số lượng khả dụng ngay lập tức trong transaction để tránh bán vượt tồn đồng thời. Số lượng ở trạng thái HELD chưa được trừ khỏi tồn bán được của đơn mới.
5. Khi Supplier chấp nhận đơn con, Inventory chuyển tồn từ HELD sang COMMITTED. Khi đơn bị từ chối, quá hạn hoặc lỗi thanh toán, Inventory gọi release đúng một lần để trả lại lượng tồn đó vào trạng thái khả dụng.

## 4. Phối hợp với các thành viên khác

- **Thành viên 1:** Cung cấp xác thực, vai trò và kiểm tra quyền sở hữu để đảm bảo Supplier chỉ sửa Product của mình, Seller chỉ sửa Listing của mình và Admin mới được duyệt/từ chối nội dung.
- **Thành viên 3:** Cung cấp dữ liệu Listing mới nhất (giá, trạng thái, productId) và thực hiện thao tác giữ tồn kho khi nhận yêu cầu từ module Orders trong luồng checkout; phải trả về kết quả đồng bộ để checkout biết ngay tồn có đủ hay không.
- **Thành viên 4:** Nhận yêu cầu commit tồn khi Supplier chấp nhận đơn và yêu cầu release tồn khi đơn con bị hủy/hoàn; không tự ý truy cập bảng inventory ngoài các cổng đã công bố.

Trong giai đoạn làm độc lập, tôi dùng mock/fixture đặt trong module của mình theo contract đã chốt. Khi tích hợp, cần kiểm thử thao tác reserve đồng thời trên PostgreSQL — kiểm thử đơn vị với mock chưa đủ để xác nhận hệ thống không bán vượt tồn trên database thật.

## 5. Tiêu chí tôi dùng để tự kiểm tra phần việc

- Supplier cập nhật giá vốn khiến biên lợi nhuận tối thiểu không đạt → Listing liên quan bị tạm dừng tự động, có audit log và thông báo Seller; giá của OrderItem cũ không thay đổi.
- Hai yêu cầu checkout đồng thời cùng Product khi tồn chỉ đủ một → chỉ một yêu cầu reserve thành công, yêu cầu còn lại nhận INSUFFICIENT_STOCK; tồn kho không bị âm.
- release được gọi đúng một lần cho mỗi lần reserve; không để tồn bị trả lại hai lần hoặc bị giữ mãi khi đơn đã kết thúc.
- Seller không thể sửa giá vốn hoặc số lượng tồn kho; Supplier không thấy Listing hay dữ liệu kinh doanh của Seller.
- Giao diện Supplier thể hiện được lịch sử biến động tồn kho; giao diện Seller hiển thị rõ trạng thái Listing và lý do tạm dừng nếu có.
