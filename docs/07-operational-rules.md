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
| Callback thành công | `CONFIRMED` | `PAID` | `HELD` đến khi đúng Supplier accept đơn con | Thông báo Supplier/Seller; chỉ accept mới commit tồn. |
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
## 7.8 Phân bổ thanh toán, COD và sổ cái tài chính

`Payment` là payment intent của toàn bộ Customer Order; mỗi lần gọi cổng thanh toán là một `PaymentAttempt`. `PaymentAllocation` là nghĩa vụ tiền của đúng một Fulfillment Order, được tạo trong checkout và không suy diễn lại từ giá hiện hành.

| Trường snapshot của PaymentAllocation | Ý nghĩa |
|---|---|
| `merchandiseAmount` | Tổng giá bán các dòng hàng của đơn con. |
| `shippingAmount` | Phí ship khách chịu cho đúng kiện hàng. |
| `discountAmount` | Giảm giá đã phân bổ theo quy tắc làm tròn xác định. |
| `amountToCollect` | `merchandiseAmount + shippingAmount - discountAmount`; là số tiền COD của kiện. |
| `currency` | MVP luôn là `VND`; số tiền là số nguyên, không dùng `float`. |

1. Tổng `amountToCollect` của các allocation đang hiệu lực phải bằng `CustomerOrder.totalPayable`.
2. Online: sau callback hợp lệ, allocation chuyển `FUNDED`; nếu đơn con bị từ chối/hủy, chỉ allocation đó tạo Refund.
3. COD: Carrier xác nhận `COLLECTED` theo từng Fulfillment Order. Nếu đơn con bị từ chối trước khi bàn giao Carrier, allocation thành `VOIDED` và tổng COD còn phải thu được tính lại trước khi tạo vận đơn.
4. Không tạo Settlement chỉ vì `DELIVERED`: điều kiện bắt buộc là allocation đã `FUNDED` hoặc `COLLECTED`, không có dispute mở, và qua cửa sổ đổi trả.
5. Mọi refund, phí, khoản phải trả Supplier, doanh thu Seller và adjustment phải ghi `FinancialEntry` append-only với `sourceRef`; cấm sửa đè số tiền lịch sử.

## 7.9 Checkout nguyên tử và idempotency phía khách

`POST /checkout` bắt buộc có `Idempotency-Key` duy nhất theo Customer. Cùng key, cùng payload phải trả về cùng Customer Order; cùng key nhưng payload khác trả `409 IDEMPOTENCY_KEY_REUSED`.

Trong **một PostgreSQL transaction**, server phải: khóa/cập nhật tồn có điều kiện; tạo Customer Order, OrderItem, snapshot giá/phí/địa chỉ; tạo Fulfillment Order và FulfillmentItem; tạo StockReservation `HELD`; tạo Payment Intent và PaymentAllocation; ghi Outbox Event. Chỉ gọi cổng thanh toán hoặc gửi notification sau khi transaction commit.

Không được gọi dịch vụ ngoài trong transaction. Callback/webhook phải deduplicate bằng `(provider, providerEventId)` và transition Payment, ledger, outbox trong cùng transaction; callback trùng luôn trả kết quả thành công không tạo side effect lần hai.

## 7.10 Đơn con, một kiện hàng và trạng thái tổng hợp

1. Một Fulfillment Order thuộc đúng một `(supplierId, sellerId)` và trong MVP có tối đa một Shipment/một `trackingNo`. Partial shipment hoặc nhiều kiện là out-of-scope, phải được từ chối bằng mã nghiệp vụ rõ ràng.
2. Một Customer Order không tự chuyển trạng thái giao hàng độc lập. `fulfillmentSummary` là projection tính từ các Fulfillment Order sau commit; API không nhận lệnh đổi trực tiếp summary này.
3. Return, evidence, tracking, reservation, payment allocation và settlement luôn tham chiếu Fulfillment Order hoặc FulfillmentItem; không thao tác mơ hồ ở cấp đơn cha.

## 7.11 Thay đổi giá nguồn và Listing đang hoạt động

Khi Supplier thay đổi `costPrice`, server đánh giá lại mọi Listing `ACTIVE` tham chiếu Product đó trong cùng luồng nghiệp vụ. Listing có `salePrice < costPrice + minMargin` chuyển `PAUSED_BY_POLICY`, không checkout được, phát notification cho Seller và audit trước/sau. Supplier giảm tồn về 0 chỉ ngăn checkout mới, không làm mất OrderItem lịch sử. Giá, tên sản phẩm, phí và mô tả đã snapshot trong đơn không được cập nhật lại.

## 7.12 SLA có hành động leo thang

| Sự kiện | Hạn MVP | Hành động khi quá hạn |
|---|---:|---|
| Online chưa thanh toán | 15 phút | Đánh dấu payment failed, release reservation và đóng checkout. |
| Supplier nhận đơn nhưng chưa accept/reject | 24 giờ | Auto-cancel với `SUPPLIER_TIMEOUT`, release tồn và tạo refund/void allocation phù hợp. |
| Đơn đã accept nhưng chưa shipped | 48 giờ | Cảnh báo Supplier, mở task Admin; Admin có thể hủy theo chính sách. |
| Supplier chưa phản hồi Return Request | 48 giờ | Escalate cho Admin, Settlement giữ `HOLD`. |
| Khách chưa gửi hàng trả sau khi được duyệt | 72 giờ | Hết hạn yêu cầu trả, đóng dispute nếu không có ngoại lệ đã phê duyệt. |

Các mốc trên là cấu hình server-side. Scheduler phải thực thi idempotent và ghi audit với reason code.

## 7.13 Quyền sở hữu và dữ liệu cá nhân

- Supplier chỉ xem tên người nhận, địa chỉ và số điện thoại của Fulfillment Order thuộc mình sau khi order đã `CONFIRMED`; không xem dữ liệu của đơn khác.
- Seller xem trạng thái, dòng hàng và số liệu tài chính liên quan Shop; chỉ xem khu vực giao hàng đã làm mờ, không xem đầy đủ số điện thoại/địa chỉ người nhận.
- Admin chỉ truy cập dữ liệu cá nhân khi phục vụ moderation, fulfillment support hoặc dispute; thao tác export/xem bằng chứng phải có audit event.
- Địa chỉ giao hàng là snapshot của Order, không đọc lại địa chỉ profile hiện tại. URL evidence/media phải là signed URL có hạn, không công khai trực tiếp.
