# 2. Workflow nghiệp vụ

## WF-01 — Onboarding và niêm yết sản phẩm

```mermaid
flowchart TD
  A([Supplier đăng ký]) --> B{Admin duyệt?}
  B -- Từ chối --> BR[Thông báo lý do và cho phép bổ sung hồ sơ]
  BR --> A
  B -- Duyệt --> C[Supplier tạo sản phẩm nguồn\nSKU, giá vốn, tồn kho, ảnh]
  C --> D{Sản phẩm cần duyệt?}
  D -- Có --> E[Admin kiểm duyệt nội dung]
  E -- Từ chối --> EF[Supplier sửa và gửi lại]
  EF --> E
  E -- Duyệt --> F[Catalog sẵn sàng]
  D -- Không --> F
  F --> G[Seller tìm và chọn sản phẩm]
  G --> H[Seller tạo Listing\nđặt giá bán, mô tả riêng]
  H --> I{Giá bán hợp lệ?}
  I -- Không --> H
  I -- Có --> J[Listing ACTIVE trên gian hàng]
```

**Rule chính:** người bán chỉ tạo `Listing` tham chiếu `Product`; không sao chép quyền sửa `costPrice`, tồn kho hoặc SKU nguồn.

## WF-02 — Checkout, tách đơn và giao hàng

```mermaid
flowchart TD
  A([Khách thêm Listing vào giỏ]) --> B[Checkout: địa chỉ, phương thức thanh toán]
  B --> C{Kiểm tra listing active\nvà tồn kho khả dụng}
  C -- Không đạt --> D[Thông báo dòng hàng không khả dụng\nKhách sửa giỏ]
  D --> A
  C -- Đạt --> E[Tạo Customer Order và Order Items\nSnapshot giá bán/giá vốn]
  E --> F[Nhóm item theo Supplier + Seller]
  F --> G[Tạo một hoặc nhiều Fulfillment Orders]
  G --> H{Phương thức thanh toán}
  H -- Online --> I[Gửi yêu cầu cổng thanh toán]
  I --> J{Callback thành công?}
  J -- Không --> K[Payment FAILED\nĐơn chờ thanh toán hoặc hủy]
  J -- Có --> L[Payment PAID]
  H -- COD --> M[Payment PENDING_COD]
  L --> N[Giữ / trừ tồn kho theo chính sách]
  M --> N
  N --> O[Thông báo supplier và seller]
  O --> P[Supplier xác nhận từng Fulfillment Order]
  P --> Q[Đóng gói và bàn giao Carrier]
  Q --> R[Tracking và trạng thái giao hàng]
  R --> S{Tất cả đơn thực hiện hoàn tất?}
  S -- Chưa --> R
  S -- Có --> T([Customer Order COMPLETED])
```

## WF-03 — Hủy, trả hàng và hoàn tiền

```mermaid
flowchart TD
  A([Khách / Seller yêu cầu hủy hoặc trả hàng]) --> B{Đơn đã bàn giao carrier?}
  B -- Chưa --> C[Supplier hoặc Admin xác nhận hủy]
  C --> D[Khôi phục tồn kho nếu đã giữ]
  D --> E{Đã thanh toán online?}
  E -- Có --> F[Tạo yêu cầu Refund]
  E -- Không / COD --> G[Đánh dấu CANCELED]
  F --> H{Refund thành công?}
  H -- Có --> G
  H -- Không --> I[Admin xử lý ngoại lệ]
  B -- Rồi --> J[Khách tạo Return Request\nkèm lý do/bằng chứng]
  J --> K[Supplier phản hồi]
  K --> L{Admin quyết định khi có tranh chấp}
  L --> M[Nhận hàng trả / xác minh]
  M --> F
```

## WF-04 — Đối soát lợi nhuận và chi trả

```mermaid
flowchart LR
  A[Fulfillment Order DELIVERED] --> B{Qua thời gian đổi trả?}
  B -- Chưa --> C[Giữ tiền đối soát]
  C --> B
  B -- Có --> D[Settlement ELIGIBLE]
  D --> E[Tính giá bán - giá vốn - phí nền tảng - phí vận chuyển]
  E --> F[Seller earning và Supplier payable]
  F --> G[Admin/Job tạo Payout batch]
  G --> H{Payout thành công?}
  H -- Không --> I[FAILED: retry / đối chiếu thủ công]
  I --> G
  H -- Có --> J([Settlement PAID])
```
