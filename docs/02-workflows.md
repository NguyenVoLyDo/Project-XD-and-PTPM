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

<!-- diagram-id: eaf0c9b1-e551-46e3-bc03-c2d4f8b7d6c5 -->
```mermaid
flowchart TD
  A([Khách thêm Listing vào giỏ]) --> B[Checkout: địa chỉ, phương thức thanh toán]
  B --> C{Kiểm tra listing active\nvà tồn kho khả dụng}
  C -- Không đạt --> D[Thông báo dòng hàng không khả dụng\nKhách sửa giỏ]
  D --> A
  C -- Đạt --> E[Bắt đầu transaction\nKhóa tồn theo điều kiện]
  E --> F[Tạo Customer Order và Order Items\nSnapshot giá, phí, địa chỉ]
  F --> G[Nhóm item theo Supplier + Seller]
  G --> H[Tạo Fulfillment Orders, Reservation HELD\nPayment, Payment Allocation và Outbox]
  H --> I[Commit transaction]
  I --> J{Phương thức thanh toán}
  J -- Online --> K[Gửi yêu cầu cổng thanh toán sau commit]
  K --> L{Callback hợp lệ và chưa xử lý?}
  L -- Không --> M[Payment FAILED\nRelease reservation đúng một lần]
  L -- Có --> N[Payment PAID\nReservation vẫn HELD]
  J -- COD --> O[Payment PENDING_COD\nGán amountToCollect cho từng kiện]
  N --> P[Thông báo Supplier và Seller]
  O --> P
  P --> Q[Supplier xác nhận từng Fulfillment Order]
  Q --> R[Commit reservation của đơn con đã ACCEPTED]
  R --> S[Đóng một kiện và bàn giao Carrier]
  S --> T[Tracking và trạng thái giao hàng]
  T --> U{Các đơn con đã có kết quả?}
  U -- Chưa --> T
  U -- Có --> V([Cập nhật trạng thái tổng hợp Customer Order])
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
