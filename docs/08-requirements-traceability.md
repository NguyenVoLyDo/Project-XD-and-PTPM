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
5. fulfillmentSummary của CustomerOrder trở thành `PARTIALLY_CANCELED`; hệ thống release tồn và hoàn tiền phần của B.
6. Sau cửa sổ đổi trả của A, hệ thống tính Settlement cho Supplier A và Seller X.

## Bổ sung traceability cho các quyết định BA bắt buộc

| ID | Yêu cầu | Artefact liên quan | Tiêu chí nghiệm thu có thể tự động hóa |
|---|---|---|---|
| FR-09 | Phân bổ thanh toán theo Fulfillment Order | BR 7.8, class/ERD PaymentAllocation, detailed checkout | Cart có 2 Fulfillment Order tạo 2 allocation; tổng `amountToCollect` bằng `totalPayable`; hủy một đơn con chỉ void/refund allocation đó. |
| FR-10 | Xử lý COD theo kiện hàng | BR 7.8, payment state, fulfillment sequence | Carrier xác nhận `COLLECTED` cho kiện A không làm kiện B thành đã thu; Supplier B reject trước ship làm giảm COD phải thu và không tạo refund gateway. |
| FR-11 | Idempotent checkout | BR 7.9, API contract, idempotency_keys | Gửi đồng thời hai request cùng key/payload chỉ tạo một order, reservation, allocation và outbox event. Cùng key/payload khác trả 409. |
| FR-12 | Tự động revalidate Listing khi giá vốn đổi | BR 7.11, Catalog/Listing module | Tăng cost làm sale price dưới margin chuyển đúng Listing sang `PAUSED_BY_POLICY`; OrderItem cũ không đổi. |
| FR-13 | SLA và escalation | BR 7.12, worker scheduler, audit log | Job chạy lại không hủy/hoàn hai lần; đơn quá 24 giờ chưa accept có `SUPPLIER_TIMEOUT`, reservation release và financial action đúng loại payment. |
| NFR-05 | Tính đúng đắn tài chính | BR 7.8, FinancialEntry, Settlement | Không dùng `float`; mọi refund/fee/payout có `sourceRef`; tổng ledger của allocation truy ra được số phải thu, hoàn và settlement. |
| NFR-06 | Bảo vệ PII theo ownership | BR 7.13, RBAC/ownership tests | Seller gọi API chi tiết đơn không nhận đủ điện thoại/địa chỉ; Supplier chỉ nhận PII của fulfillment thuộc mình; audit có actor và lý do. |
| NFR-07 | Độ tin cậy outbox/webhook | BR 7.9, outbox_events, provider_events | Provider gửi lại cùng event ID không tạo ledger/refund thứ hai; worker retry sau lỗi vẫn publish event đúng một lần về mặt nghiệp vụ. |

## Ma trận UAT rủi ro cao

1. **Online đa Supplier:** trả tiền một lần cho hai kiện; Supplier A accept/giao, Supplier B reject; chỉ B release tồn và refund allocation, A chỉ settlement sau return window.
2. **COD đa Supplier:** hai kiện có `amountToCollect` riêng; B reject trước ship; tổng phải thu của A được cập nhật, không gọi refund online.
3. **Race tồn kho:** hai Customer checkout cùng SKU với lượng tồn bằng một cart; chỉ một transaction thành công, transaction còn lại trả lỗi item-level, không có reservation mồ côi.
4. **Callback và scheduler lặp:** gửi hai payment webhook giống nhau và chạy job timeout hai lần; số order, reservation, refund, ledger và notification nghiệp vụ không tăng thêm.
5. **Giá vốn đổi:** Seller có hai Listing của cùng Product; chỉ Listing vi phạm margin bị pause, audit và notification có trước/sau, đơn lịch sử giữ nguyên snapshot.
