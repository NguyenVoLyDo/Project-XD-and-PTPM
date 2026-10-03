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
  H --> I{Giá bán hợp lệ?\nsalePrice >= costPrice + minMargin}
  I -- Không --> H
  I -- Có --> J[Listing ACTIVE trên gian hàng]

  subgraph PriceChange[Xử lý biến động giá vốn]
    K[Supplier cập nhật giá vốn mới] --> L{costPrice mới > salePrice\nhoặc vi phạm minMargin?}
    L -- Không --> M[Cập nhật giá vốn ngầm\nListing giữ nguyên]
    L -- Có --> N[Listing chuyển PAUSED_BY_POLICY\nTạm ẩn khỏi gian hàng]
    N --> O[Hệ thống cảnh báo Seller qua Notification]
    O --> P[Seller cập nhật giá bán mới]
    P --> I
  end
  C -.-> K
  J -.-> L
```

**Quy tắc nghiệp vụ chính:**
- Người bán chỉ tạo `Listing` tham chiếu `Product`; không có quyền sửa `costPrice`, tồn kho hoặc SKU nguồn.
- **Xử lý biến động giá vốn:** Khi Supplier tăng giá vốn `costPrice` khiến `salePrice < costPrice + minMargin`, hệ thống tự động chuyển trạng thái Listing sang `PAUSED_BY_POLICY` và tạm ẩn trên gian hàng để bảo vệ Seller không bị lỗ. Seller nhận thông báo và phải cập nhật lại giá bán mới hợp lệ để kích hoạt lại Listing.

---

## WF-02 — Checkout, giữ tồn kho, tách đơn và giao hàng

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
  G --> H[Tạo Fulfillment Orders, Reservation HELD kèm TTL\nPayment, Payment Allocation và Outbox]
  H --> I[Commit transaction]
  I --> J{Phương thức thanh toán}
  J -- Online --> K[Gửi yêu cầu cổng thanh toán sau commit]
  K --> L{Callback hợp lệ và chưa xử lý?}
  L -- Không --> M[Payment FAILED\nRelease reservation đúng một lần]
  L -- Có --> N[Payment PAID\nReservation vẫn HELD đến Supplier accept]
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

**Quy tắc nghiệp vụ chính:**
- **Thời điểm giữ tồn kho (Reservation):** Ngay khi qua bước kiểm tra giỏ hàng hợp lệ, hệ thống tạo bản ghi `StockReservation` ở trạng thái `HELD` kèm thời hạn (TTL 15 phút với Online, 24 giờ với COD). Việc này chặn đứng nguy cơ bán vượt tồn kho (Overselling) trong lúc khách đang thao tác thanh toán.
- **Commit và Release tồn:** Nếu thanh toán thất bại/quá hạn TTL, tồn kho được giải phóng (`RELEASED`) ngay lập tức. Tồn kho thực chỉ bị trừ vĩnh viễn (`COMMITTED`) khi Supplier bấm chấp nhận đơn (`ACCEPTED`).

---

## WF-03 — Hủy, trả hàng và hoàn tiền

```mermaid
flowchart TD
  A([Khách / Seller yêu cầu hủy hoặc trả hàng]) --> B{Đơn đã bàn giao carrier?}
  B -- Chưa --> C[Supplier hoặc Admin xác nhận hủy]
  C --> D[Giải phóng tồn kho RELEASED]
  D --> E{Phương thức thanh toán gốc?}
  E -- Online đã trừ tiền --> F[Hoàn tiền tự động qua Gateway]
  E -- COD chưa thu tiền --> G[Đánh dấu CANCELED\nKhông phát sinh hoàn tiền]
  F --> H{Hoàn tiền thành công?}
  H -- Có --> G
  H -- Không --> I[Admin xử lý ngoại lệ]
  B -- Rồi --> J[Khách tạo Return Request\nkèm lý do/ảnh bằng chứng]
  J --> K{Xác định nguyên nhân & phí ship trả}
  K -- Lỗi do SP / Supplier --> K1[Supplier chịu phí ship trả\nKhấu trừ supplierPayable]
  K -- Khách đổi ý hợp lệ --> K2[Khách chịu phí ship trả\nTrừ vào số tiền hoàn lại]
  K1 & K2 --> L[Supplier/Admin thẩm định & duyệt]
  L --> M[Carrier nhận hàng trả / Supplier xác minh]
  M --> REF{Phương thức thanh toán gốc?}
  REF -- Online --> F
  REF -- COD --> N[Khách cung cấp STK ngân hàng\nAdmin tạo lệnh chuyển khoản hoàn tiền]
  N --> G
```

**Quy tắc nghiệp vụ chính:**
- **Hoàn tiền cho đơn COD:** Do tiền COD khách thanh toán bằng tiền mặt cho shipper và được Carrier nộp về Nền tảng, khi có yêu cầu hoàn tiền COD hợp lệ, hệ thống yêu cầu Khách hàng cung cấp thông tin tài khoản ngân hàng để Admin/kế toán thực hiện lệnh chuyển khoản hoàn tiền trực tiếp (`Bank Transfer Refund`).
- **Phân định phí vận chuyển chiều trả hàng:**
  - *Lỗi sản phẩm / Nhà cung cấp (giao sai mẫu, hỏng hóc, sai mô tả):* Supplier chịu 100% chi phí vận chuyển chiều trả hàng (trừ trực tiếp vào đối soát `supplierPayable`).
  - *Lỗi chủ quan từ Khách hàng (đổi ý trong thời hạn cho phép):* Khách hàng tự chịu phí ship trả lại cho kho Supplier (khấu trừ vào số tiền hoàn nhận về).

---

## WF-04 — Đối soát lợi nhuận và chi trả

```mermaid
flowchart LR
  A[Fulfillment Order DELIVERED] --> B{Qua thời gian đổi trả?}
  B -- Chưa --> C[Giữ tiền đối soát HOLD]
  C --> B
  B -- Có --> D[Settlement ELIGIBLE]
  D --> E[Tính: Giá bán - Giá vốn - Phí sàn - Phí ship chia sẻ - Điều chỉnh hoàn trả]
  E --> F[Xác định Seller Earning và Supplier Payable]
  F --> G[Admin/Hệ thống tạo đợt Payout Batch]
  G --> H{Payout thành công?}
  H -- Không --> I[FAILED: retry hoặc kiểm tra STK]
  I --> G
  H -- Có --> J([Settlement PAID])
```
