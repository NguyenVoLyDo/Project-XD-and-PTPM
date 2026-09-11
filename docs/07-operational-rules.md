# 7. Quy tắc vận hành chi tiết

Tài liệu này làm rõ các điều kiện mà sơ đồ UML không thể hiện hết. Đây là quy ước MVP để đội phát triển, kiểm thử và giảng viên cùng hiểu một luồng nghiệp vụ.

## 7.1 Quy tắc định danh và phân quyền

| Mã | Quy tắc | Kiểm tra thực thi |
|---|---|---|
| BR-01 | Một `User` có thể vừa là Seller vừa là Supplier, nhưng mỗi thao tác phải chạy trong đúng hồ sơ vai trò. | RBAC kiểm tra `actorId`, role và `profileId`. |
| BR-02 | Chỉ Supplier đã `APPROVED` mới tạo/sửa Product và nhận Fulfillment Order. | Chặn API nếu `approvalStatus != APPROVED`. |
| BR-03 | Chỉ Seller đã `APPROVED` và Shop `ACTIVE` mới tạo Listing `ACTIVE`. | Kiểm tra trước khi publish Listing. |
| BR-04 | Seller không được sửa SKU nguồn, giá vốn, tồn kho hoặc Supplier của Product. | Listing chỉ lưu `productId`, giá bán và nội dung được phép tùy biến. |
| BR-05 | Supplier chỉ thấy thông tin cần giao hàng của Fulfillment Order thuộc mình; Seller chỉ thấy đơn có Listing thuộc Shop mình. | Áp dụng filter sở hữu tại truy vấn, không chỉ ẩn ở giao diện. |

## 7.2 Checkout và tách đơn

### Điều kiện trước

1. Customer đã đăng nhập, giỏ hàng không rỗng và có địa chỉ giao hợp lệ.
2. Mọi `Listing` phải `ACTIVE`, `visible = true` và Product nguồn phải `ACTIVE`.
3. Số lượng đặt không vượt `availableStock - reservedStock` tại thời điểm kiểm tra.
4. Giá, phí vận chuyển và khuyến mại phải được tính lại tại server; không tin giá từ trình duyệt.

### Giao dịch bắt buộc

Checkout chạy trong giao dịch dữ liệu hoặc dùng cơ chế outbox/event đáng tin cậy:

1. Khóa hoặc cập nhật nguyên tử tồn kho khả dụng.
2. Tạo `CustomerOrder`, `OrderItem` và snapshot giá bán, giá vốn, tên Product/Listing.
3. Nhóm từng `OrderItem` theo khóa `(supplierId, sellerId)`; mỗi nhóm tạo đúng một `FulfillmentOrder`.
4. Tạo `Payment` và bản ghi `StockReservation`.
5. Chỉ gửi event `OrderCreated` sau khi dữ liệu đã commit.

### Quy tắc thanh toán và giữ tồn

| Tình huống | Customer Order | Payment | StockReservation | Hành động tiếp theo |
|---|---|---|---|---|
| Online vừa checkout | `PENDING_PAYMENT` | `PENDING` | `HELD` | Chờ callback hợp lệ trong TTL. |
| Callback thành công | `CONFIRMED` | `PAID` | `COMMITTED` hoặc tiếp tục `HELD` đến Supplier accept | Thông báo Supplier/Seller. |
| Callback thất bại hoặc hết TTL | `PAYMENT_FAILED` / `CANCELED` | `FAILED` | `RELEASED` | Cho phép Customer thử lại nếu chưa hết TTL đơn. |
| COD | `CONFIRMED` | `PENDING_COD` | `HELD` | Supplier nhận và xác nhận đơn. |
| Supplier từ chối vì hết hàng | `PARTIALLY_CANCELED` hoặc `CANCELED` | Không đổi ngay | `RELEASED` cho các dòng bị từ chối | Hoàn tiền phần tương ứng nếu đã thu tiền. |

**TTL MVP đề xuất:** reservation 15 phút với Online chưa thanh toán; 24 giờ với COD chưa được Supplier xác nhận. Đây là tham số cấu hình, không hard-code trong client.

## 7.3 Quy tắc tồn kho

| Mã | Quy tắc |
|---|---|
| INV-01 | `availableStock` không được âm; tất cả thao tác reserve/commit/release là nguyên tử. |
| INV-02 | Reservation thuộc một `OrderItem`, có `expiresAt`, số lượng và trạng thái độc lập. |
| INV-03 | Khi Supplier `ACCEPTED`, reservation được commit và tồn kho thực giảm một lần duy nhất. |
| INV-04 | Callback thanh toán hoặc webhook giao vận đến trùng lặp không được trừ tồn/hoàn tiền lần hai. |
| INV-05 | Product hết hàng vẫn giữ lịch sử OrderItem; chỉ Listing mới không thể checkout. |

## 7.4 Điều kiện chuyển trạng thái Fulfillment Order

| Từ trạng thái | Sang trạng thái | Actor được phép | Điều kiện/side effect |
|---|---|---|---|
| `PENDING_ACCEPTANCE` | `ACCEPTED` | Supplier | Reservation còn hiệu lực; tạo audit log; commit tồn. |
| `PENDING_ACCEPTANCE` | `REJECTED` | Supplier/Admin | Có reason code; release tồn; phát sinh refund phần đơn nếu cần. |
| `ACCEPTED` | `PACKING` | Supplier | Đã có thông tin giao hàng hợp lệ. |
| `PACKING` | `READY_TO_SHIP` | Supplier | Có kiện hàng và phí ship xác định. |
| `READY_TO_SHIP` | `SHIPPED` | Supplier/Carrier | Có `trackingNo`; carrier được cấu hình. |
| `SHIPPED` / `IN_TRANSIT` | `DELIVERED` | Carrier/Supplier có bằng chứng | Lưu thời điểm giao, bằng chứng và nguồn cập nhật. |
| `DELIVERED` | `RETURN_REQUESTED` | Customer | Trong cửa sổ đổi trả và có lý do. |
| `RETURNED` | `REFUNDED` | Admin/Payment Service | Có quyết định hoàn tiền và giao dịch refund thành công. |

Không cho phép bỏ qua trạng thái: ví dụ `PENDING_ACCEPTANCE → SHIPPED` hoặc `PACKING → DELIVERED`.

## 7.5 Ngoại lệ, tranh chấp và idempotency

| Sự kiện | Cách xử lý |
|---|---|
| Payment webhook thiếu/chữ ký sai | Ghi audit, trả lỗi, không thay đổi Payment/Order. |
| Payment webhook trùng `transactionRef` | Trả `200 OK`, không lặp side effect. |
| Carrier gửi `DELIVERED` sau khi đơn đã `CANCELED` | Đưa vào hàng chờ exception và Admin xử lý, không tự hoàn tất đơn. |
| Một đơn con bị từ chối | Customer Order là `PARTIALLY_CANCELED`; chỉ hoàn tiền phần item bị ảnh hưởng. |
| Tranh chấp đổi trả | Đóng băng `Settlement` ở `HOLD`; Admin quyết định `APPROVED` hoặc `REJECTED`. |
| Chi trả Supplier/Seller lỗi | `PAYOUT_FAILED`, có retry an toàn dựa trên idempotency key của payout. |

## 7.6 Quy tắc tài chính và đối soát

`sellerEarning = lineSaleTotal - supplierPayable - platformFee - sellerShippingShare - refundAdjustment`.

MVP có thể ghi nhận `supplierPayable` theo giá vốn snapshot nhân số lượng và chỉ tạo Settlement khi Fulfillment `DELIVERED`. Tiền được giữ ở `HOLD` đến hết cửa sổ đổi trả; nếu hoàn tiền, `refundAdjustment` phải được lưu thành bút toán mới, không ghi đè số tiền lịch sử.

## 7.7 SLA và thông báo MVP

| Sự kiện | Người nhận | SLA đề xuất | Nội dung tối thiểu |
|---|---|---:|---|
| Có Fulfillment Order mới | Supplier, Seller | Ngay sau commit | Mã đơn con, số lượng, hạn xác nhận. |
| Supplier chưa xác nhận | Supplier, Admin | 24 giờ | Cảnh báo sắp hết hạn. |
| Shipment thay đổi trạng thái | Customer, Seller | Ngay khi nhận webhook | Mã tracking và trạng thái mới. |
| Có yêu cầu trả hàng | Supplier, Seller, Admin | Ngay lập tức | Lý do, bằng chứng, hạn phản hồi. |
| Settlement đủ điều kiện | Seller, Supplier | Theo batch hàng ngày | Số tiền dự kiến, kỳ chi trả. |
