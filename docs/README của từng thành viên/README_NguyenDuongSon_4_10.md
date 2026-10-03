# Báo cáo hiểu biết về dự án và công việc — Nguyễn Dương Sơn

**Thành viên:** Nguyễn Dương Sơn (thành viên 3)

**Phần phụ trách:** Trải nghiệm mua sắm của khách hàng, giỏ hàng và đơn hàng trong dự án DropConnect.

## 1. Tôi hiểu dự án như thế nào

DropConnect là nền tảng dropshipping nội địa kết nối ba bên: nhà cung cấp (Supplier) có sản phẩm và quản lý tồn kho; người bán (Seller) chọn sản phẩm để đăng bán trên gian hàng với giá riêng; khách hàng (Customer) tìm kiếm, mua và theo dõi đơn. Quản trị viên (Admin) phụ trách duyệt tài khoản, giám sát và xử lý các tình huống cần can thiệp. Mục tiêu là giúp người bán kinh doanh mà không phải tự nhập và lưu kho, đồng thời giúp nhà cung cấp nhận đơn từ nhiều gian hàng trong một quy trình rõ ràng.

Theo tôi, điểm quan trọng của hệ thống nằm ở việc một lần mua có thể chứa hàng của nhiều nhà cung cấp và người bán. Khách hàng cần thấy một đơn mua thống nhất, còn hệ thống phải xác định chính xác phần hàng, tồn kho, thanh toán và giao nhận của từng bên. Vì vậy, khi đặt hàng, hệ thống tạo một `CustomerOrder` cho khách và tách thành các `FulfillmentOrder` theo từng cặp `(supplierId, sellerId)`. Nếu một đơn con bị từ chối hoặc giao thất bại, chỉ phần liên quan được hủy hoặc hoàn tiền; các đơn con khác vẫn tiếp tục xử lý.

## 2. Công việc tôi phụ trách

| Mảng | Công việc và kết quả cần có |
|---|---|
| Giao diện khách hàng | Xây dựng trang công khai: trang chủ, danh mục, tìm kiếm/lọc và chi tiết Listing; xây dựng trang giỏ hàng, checkout, danh sách và chi tiết đơn của khách. |
| `cart` | Cho khách đã đăng nhập xem, thêm, cập nhật số lượng và xóa Listing trong giỏ. Một khách chỉ thao tác trên giỏ của mình; giá và tình trạng hàng hiển thị ở giỏ là thông tin tạm tính. |
| `orders` | Điều phối checkout, kiểm tra lại Listing/giá/tồn từ phía server, lưu snapshot tại thời điểm mua, tạo đơn cha và các đơn con, cung cấp API xem đơn theo quyền sở hữu. |
| Chất lượng và bàn giao | Viết contract, mock/fixture và kiểm thử cho các luồng thuộc phần mình; phối hợp tích hợp với Identity, Listings/Inventory, Payments/Fulfillment theo cổng giao tiếp đã thống nhất. |

Phạm vi mã nguồn của tôi là `backend/src/modules/cart`, `backend/src/modules/orders` và các route `frontend/src/app/(public)/*`, `frontend/src/app/(customer)/cart`, `frontend/src/app/(customer)/checkout`, `frontend/src/app/(customer)/orders/*`. Tôi không thay đổi trực tiếp dữ liệu hoặc quy tắc nội bộ của module do thành viên khác sở hữu.

## 3. Cách tôi hiểu luồng mua hàng

1. Khách xem các Listing đang được phép bán, chọn sản phẩm và cập nhật số lượng trong giỏ. Giỏ không giữ chỗ tồn kho và tổng tiền trong giỏ chỉ là ước tính.
2. Khi khách checkout, backend kiểm tra lại giá, trạng thái Listing và lượng hàng có thể bán. Nếu giá thay đổi, hệ thống báo `PRICE_CHANGED` để khách xác nhận lại; nếu không đủ hàng, báo `INSUFFICIENT_STOCK`. Tôi không dùng giá, tổng tiền hay ID Supplier/Seller do trình duyệt tự gửi để tạo đơn.
3. Checkout lưu snapshot của giá, tên sản phẩm và địa chỉ giao hàng, đồng thời yêu cầu Inventory giữ tồn. Một lần checkout tạo một `CustomerOrder`; từng nhóm hàng có cùng cặp Supplier–Seller tạo một `FulfillmentOrder` và khoản phân bổ thanh toán tương ứng. Tiền VND được xử lý bằng số nguyên.
4. Yêu cầu checkout bắt buộc có `Idempotency-Key`: gửi lại cùng key và cùng nội dung phải nhận đúng kết quả đã lưu, không sinh đơn hoặc lần giữ tồn thứ hai; dùng lại key với nội dung khác phải bị từ chối.
5. Sau khi đơn được tạo, Payments xử lý nghĩa vụ thanh toán; Fulfillment xử lý xác nhận, giao hàng và thay đổi trạng thái của từng đơn con. Phía Orders cập nhật thông tin tổng hợp cho khách từ các sự kiện hợp lệ, không tự thay thế trách nhiệm của hai module đó.

## 4. Phối hợp với các thành viên khác

- **Thành viên 1:** Cung cấp xác thực, vai trò và thông tin người dùng hiện tại để tôi bảo vệ Cart và Order theo quyền sở hữu.
- **Thành viên 2:** Cung cấp dữ liệu Listing và thao tác giữ tồn qua Inventory. Checkout cần dữ liệu mới nhất ở server, vì Listing có thể đổi giá hoặc ngừng bán sau khi khách thêm vào giỏ.
- **Thành viên 4:** Tiếp nhận đơn con để xử lý thanh toán, xác nhận của Supplier, giao hàng và hoàn tiền theo từng phần; gửi sự kiện trạng thái để khách theo dõi đơn.

Trong giai đoạn làm độc lập, tôi dùng mock/fixture đặt trong module của mình theo contract đã chốt. Khi tích hợp, các adapter được nối với cổng giao tiếp thật; transaction tạo đơn, giữ tồn, phân bổ thanh toán và outbox cần được kiểm thử trên PostgreSQL, đặc biệt với hai yêu cầu đồng thời. Việc chạy kiểm thử bằng mock chưa đủ để kết luận hệ thống đã chống bán vượt tồn hoặc chống tạo đơn trùng trên database thật.

## 5. Tiêu chí tôi dùng để tự kiểm tra phần việc

- Giỏ có hàng của hai Supplier tạo đúng một đơn cha và hai đơn con. Trường hợp cùng một Supplier nhưng hai Seller khác nhau cũng phải tách thành hai đơn con.
- Hai lần checkout cùng `Idempotency-Key` và cùng nội dung chỉ tạo một đơn; key trùng nhưng nội dung khác trả lỗi phù hợp.
- Khách không thể xem hoặc sửa giỏ/đơn của người khác; checkout không tin giá và quyền do client cung cấp.
- Mỗi đơn con có phần tiền và phần tồn được gắn đúng; một đơn con bị từ chối không làm mất đơn con còn lại.
- Giao diện thể hiện được trạng thái đang tải, trống, thành công và lỗi; khách được thông báo rõ khi giá đổi hoặc hết hàng.
