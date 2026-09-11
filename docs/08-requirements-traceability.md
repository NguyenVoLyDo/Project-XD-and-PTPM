# 8. Traceability yêu cầu và tiêu chí nghiệm thu

Mỗi yêu cầu bên dưới có sơ đồ tham chiếu và tiêu chí có thể kiểm thử. Mã yêu cầu nên được dùng lại trong backlog, test case và báo cáo đồ án.

| ID | Yêu cầu chức năng | Sơ đồ / dữ liệu liên quan | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-01 | Đăng ký, duyệt và phân quyền Supplier/Seller | UC, WF-01, `User`, `SupplierProfile`, `SellerProfile` | Tài khoản chưa duyệt không thể publish Product/Listing. |
| FR-02 | Supplier quản lý Product, giá vốn và tồn | WF-01, ERD, Inventory state | Product hết hàng không thể được checkout; Seller không sửa được giá vốn. |
| FR-03 | Seller tạo Listing với giá bán riêng | WF-01, class diagram | Hai Shop có thể bán cùng Product với hai giá khác nhau. |
| FR-04 | Customer checkout đa Supplier/Seller | WF-02, SD-01, detailed checkout | Một cart có 2 nhóm hàng tạo 1 Customer Order và 2 Fulfillment Order đúng cặp. |
| FR-05 | Hỗ trợ Online/COD và callback an toàn | Payment state, SD-03 | Webhook trùng không làm Payment/Order chuyển trạng thái hai lần. |
| FR-06 | Supplier xác nhận, giao hàng và tracking | Fulfillment state, SD-02 | Chỉ Supplier sở hữu đơn cập nhật được tracking; Customer nhận thông báo. |
| FR-07 | Hủy, trả hàng, hoàn tiền một phần | WF-03, Dispute state | Từ chối một Fulfillment Order chỉ hoàn phần tiền tương ứng. |
| FR-08 | Đối soát lợi nhuận và payout | WF-04, Settlement state | Settlement chỉ `ELIGIBLE` sau `DELIVERED` và hết cửa sổ đổi trả. |
| NFR-01 | An toàn phân quyền | Actor matrix, BR-01 đến BR-05 | API trả 403 khi actor truy cập dữ liệu không thuộc quyền sở hữu. |
| NFR-02 | Nhất quán tồn kho | INV-01 đến INV-05 | Hai checkout đồng thời không làm tồn kho âm. |
| NFR-03 | Audit và truy vết | State rules, SD-03 | Mỗi transition lưu actor, thời điểm, lý do, nguồn event. |
| NFR-04 | Idempotency tích hợp | SD-03, exception rules | Gửi lại cùng webhook/payout request không tạo bản ghi tài chính thứ hai. |

## Bộ dữ liệu UAT tối thiểu

| Dữ liệu | Giá trị mẫu | Mục đích |
|---|---|---|
| Supplier A, Supplier B | Đều `APPROVED` | Kiểm tra tách đơn. |
| Seller X, Seller Y | Hai Shop `ACTIVE` | Kiểm tra pricing theo Listing. |
| Product P1, P2 | P1 của A; P2 của B; còn tồn | Cart đa Supplier. |
| Listing L1, L2 | Cùng hoặc khác Seller | Kiểm tra nhóm `(supplierId, sellerId)`. |
| Customer C | Có địa chỉ hợp lệ | Thực hiện checkout. |

## Kịch bản demo nên trình bày

1. Supplier A và B tạo Product; Seller X niêm yết sản phẩm với giá bán riêng.
2. Customer thêm L1 và L2 vào cùng giỏ, thanh toán Online hoặc COD.
3. Hệ thống hiển thị một Customer Order và các Fulfillment Order đã tách.
4. Supplier A nhận đơn, tạo tracking và giao thành công; Supplier B từ chối do hết hàng.
5. Customer Order trở thành `PARTIALLY_CANCELED`; hệ thống release tồn và hoàn tiền phần của B.
6. Sau cửa sổ đổi trả của A, hệ thống tính Settlement cho Supplier A và Seller X.
