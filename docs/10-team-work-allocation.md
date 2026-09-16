# 10. Phân công triển khai cân bằng cho nhóm 4 người

Mỗi thành viên sở hữu 4 mảng chức năng. Phân chia theo ranh giới nghiệp vụ để có thể làm song song và giảm xung đột mã nguồn.

## Quy ước chung

- Làm trên branch riêng: feature/<module>-<mo-ta>.
- Mỗi endpoint phải kiểm tra RBAC, ownership và ghi audit khi thay đổi trạng thái.
- VND lưu số nguyên, không dùng float.
- Người sở hữu module chịu trách nhiệm test business rule, cập nhật API contract và UAT case của module đó.

## Bảng chia đều chức năng

| Thành viên | 4 mảng chức năng sở hữu | Khu vực chính |
|---|---|---|
| Người 1 | Identity & RBAC; Profile/Approval; Admin; Dispute/Notification/Audit | common, identity, admin, disputes, notifications |
| Người 2 | Supplier Product; Quản lý tồn gốc; Shop; Listing/Pricing | catalog, listings, portal Supplier/Seller |
| Người 3 | Storefront; Cart; Checkout; Customer Order & reservation | cart, orders, phần reservation của inventory, portal Customer |
| Người 4 | Payment; Fulfillment; Shipment/Tracking; Settlement/Ledger | payments, fulfillment, settlements |

## Người 1 — Identity, quản trị và xử lý sau bán

1. Đăng ký, đăng nhập, JWT, active role, RBAC.
2. User, Supplier/Seller profile, Admin duyệt/khóa tài khoản.
3. Admin dashboard, audit log và kiểm tra ownership dùng chung.
4. Request hủy/trả hàng/tranh chấp, thông báo in-app/mock và quyết định approve/reject tranh chấp.

Nghiệm thu: tài khoản chưa duyệt không publish; role sai trả 403; dispute chỉ do đúng customer tạo và quyết định của Admin có audit/notification.

## Người 2 — Nguồn hàng và kênh bán

1. Supplier CRUD Product, giá vốn, mô tả và trạng thái Product.
2. Supplier cập nhật tồn kho gốc; cung cấp API đọc tồn cho checkout.
3. Seller CRUD Shop.
4. Seller tạo/publish/pause Listing, định giá và kiểm tra margin.

Nghiệm thu: Supplier chỉ sửa Product/tồn của mình; hai Shop bán cùng Product với giá khác; Listing dưới margin hoặc Product hết tồn không active.

## Người 3 — Trải nghiệm mua và tạo đơn

1. Storefront tìm kiếm/xem Listing active.
2. Cart và CartItem.
3. Checkout: revalidate giá/tồn, snapshot giá, idempotency và tạo PaymentIntent mock.
4. CustomerOrder, OrderItem, tách FulfillmentOrder theo cặp supplierId, sellerId; stock reservation HELD/COMMITTED/RELEASED.

Nghiệm thu: cart đa Supplier tạo 1 đơn tổng và đúng các đơn con; request cùng idempotency key không tạo đơn thứ hai; checkout đồng thời không làm tồn âm.

## Người 4 — Vận hành thanh toán và giao nhận

1. Payment online/COD mô phỏng, callback idempotent và PaymentAllocation theo FulfillmentOrder.
2. Supplier accept/reject fulfillment; chỉ commit/release reservation theo kết quả.
3. Shipment: tracking, shipped/delivered và đồng bộ trạng thái đơn cha.
4. Refund đã được Admin duyệt, Settlement, FinancialEntry append-only và payout mock.

Nghiệm thu: webhook trùng không tạo payment/ledger thứ hai; Supplier chỉ cập nhật đơn của mình; reject một đơn con chỉ refund allocation tương ứng; settlement chỉ eligible sau delivered + return window.

## Hợp đồng bàn giao giữa người làm

| Bên cung cấp | Bên sử dụng | Hợp đồng tối thiểu |
|---|---|---|
| Người 1 | 2, 3, 4 | JWT chứa active role/profile; guard RBAC/ownership; API profile approval |
| Người 2 | 3 | Listing active: listingId, productId, supplierId, sellerId, salePrice, availableStock, status |
| Người 3 | 4 | FulfillmentOrder, OrderItem snapshot, StockReservation, PaymentIntent |
| Người 1 | 4 | Dispute/return được approve hoặc reject; lý do và phạm vi FulfillmentOrder |
| Người 4 | 1, 3 | Payment/fulfillment/shipment status và notification event |

## Thứ tự tích hợp

1. Người 1 và 2 khởi động song song: auth/profile + catalog/listing.
2. Người 3 tích hợp Listing active để làm Cart/Checkout/Order.
3. Người 4 tích hợp FulfillmentOrder và PaymentIntent để làm payment/giao nhận/settlement.
4. Cả nhóm chạy UAT: 2 Supplier, 1 Seller, 1 Customer; Supplier A giao thành công, Supplier B từ chối và chỉ phần B được hoàn tiền.
