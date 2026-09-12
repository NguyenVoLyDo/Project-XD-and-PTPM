# 3. State machine

## 3.1 Customer Order

`Customer Order` là trạng thái tổng hợp ở góc nhìn khách hàng. Nó chỉ `COMPLETED` khi mọi `Fulfillment Order` hoàn tất và hết thời hạn khiếu nại (7 ngày); `PARTIALLY_*` khi các đơn con có kết quả khác nhau. Khi đã chuyển sang `COMPLETED`, hệ thống **khóa chặt không cho phép mở yêu cầu trả hàng (`RETURN_REQUESTED`)**.

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> PENDING_PAYMENT: checkout
  PENDING_PAYMENT --> CONFIRMED: paid online / chọn COD
  PENDING_PAYMENT --> PAYMENT_FAILED: payment failed
  PAYMENT_FAILED --> PENDING_PAYMENT: thử thanh toán lại
  PAYMENT_FAILED --> CANCELED: hết hạn thanh toán
  CONFIRMED --> PROCESSING: có fulfillment order được xác nhận
  CONFIRMED --> CANCELED: hủy toàn bộ trước khi giao
  PROCESSING --> PARTIALLY_FULFILLED: một số đơn con đang giao/hoàn tất
  PROCESSING --> FULFILLED: tất cả đơn con delivered
  PROCESSING --> PARTIALLY_CANCELED: một đơn con canceled
  PARTIALLY_FULFILLED --> FULFILLED: tất cả đơn con delivered
  PARTIALLY_FULFILLED --> PARTIALLY_CANCELED: có đơn con canceled
  PARTIALLY_CANCELED --> CANCELED: tất cả đơn con canceled
  PARTIALLY_CANCELED --> PARTIALLY_REFUNDED: hoàn tiền phần đơn con bị hủy
  
  FULFILLED --> COMPLETED: hết 7 ngày đổi trả (khóa return)
  FULFILLED --> RETURN_REQUESTED: khách yêu cầu trả hàng (trong 7 ngày)
  
  RETURN_REQUESTED --> REFUNDED: hoàn tiền toàn bộ
  RETURN_REQUESTED --> PARTIALLY_REFUNDED: hoàn tiền một phần đơn
  RETURN_REQUESTED --> COMPLETED: khiếu nại bị từ chối / hết hạn

  COMPLETED --> [*]
  CANCELED --> [*]
  REFUNDED --> [*]
  PARTIALLY_REFUNDED --> [*]
```

---

## 3.2 Fulfillment Order

Quản lý chu trình thực hiện của từng kiện hàng theo cặp Supplier – Seller. Có cơ chế giới hạn giao lại tối đa 3 lần và nhánh từ chối trả hàng (`RETURN_REJECTED`).

```mermaid
stateDiagram-v2
  [*] --> PENDING_ACCEPTANCE: hệ thống tách đơn
  PENDING_ACCEPTANCE --> ACCEPTED: supplier xác nhận
  PENDING_ACCEPTANCE --> REJECTED: supplier từ chối / hết hàng
  PENDING_ACCEPTANCE --> CANCELED: customer/admin hủy hợp lệ
  ACCEPTED --> PACKING: bắt đầu đóng gói
  ACCEPTED --> CANCELED: hủy trước bàn giao
  PACKING --> READY_TO_SHIP: tạo vận đơn
  READY_TO_SHIP --> SHIPPED: bàn giao carrier
  SHIPPED --> IN_TRANSIT: carrier quét nhận
  IN_TRANSIT --> DELIVERED: giao thành công
  IN_TRANSIT --> DELIVERY_FAILED: giao không thành công
  
  DELIVERY_FAILED --> IN_TRANSIT: giao lại (lần <= 3)
  DELIVERY_FAILED --> RETURNING: giao thất bại > 3 lần (hoàn kho)
  
  DELIVERED --> RETURN_REQUESTED: mở yêu cầu đổi trả (trong 7 ngày)
  RETURN_REQUESTED --> RETURN_REJECTED: từ chối đổi trả (không hợp lệ)
  RETURN_REJECTED --> DELIVERED: giữ nguyên trạng thái giao thành công
  RETURN_REQUESTED --> RETURNING: chấp nhận đổi trả
  
  RETURNING --> RETURNED: supplier nhận hàng trả
  RETURNED --> REFUNDED: hoàn tiền hoàn tất
  
  REJECTED --> [*]
  CANCELED --> [*]
  REFUNDED --> [*]
```

---

## 3.3 Payment

Quản lý vòng đời thanh toán trực tuyến và COD. Bổ sung trạng thái `VOIDED` khi đơn COD bị hủy/boom hàng và `PARTIALLY_REFUNDED` khi hoàn tiền theo từng đơn con.

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> AUTHORIZED: cổng thanh toán ủy quyền
  AUTHORIZED --> PAID: capture thành công
  PENDING --> PAID: callback thanh toán thành công
  PENDING --> FAILED: callback thất bại / hết hạn
  PENDING --> PENDING_COD: khách chọn COD
  PENDING_COD --> COLLECTED: carrier xác nhận thu tiền COD
  PENDING_COD --> VOIDED: khách hủy / boom hàng giao thất bại
  
  PAID --> REFUND_PENDING: hủy / hoàn hàng được duyệt
  COLLECTED --> REFUND_PENDING: duyệt hoàn tiền COD (chuyển khoản)
  
  REFUND_PENDING --> REFUNDED: hoàn tiền toàn bộ thành công
  REFUND_PENDING --> PARTIALLY_REFUNDED: hoàn tiền một phần (tách đơn)
  REFUND_PENDING --> REFUND_FAILED: hoàn tiền lỗi
  REFUND_FAILED --> REFUND_PENDING: retry lệnh hoàn tiền
  
  FAILED --> [*]
  VOIDED --> [*]
  REFUNDED --> [*]
  PARTIALLY_REFUNDED --> [*]
```

---

## 3.4 Settlement (đối soát)

```mermaid
stateDiagram-v2
  [*] --> HOLD: đơn delivered
  HOLD --> ELIGIBLE: hết 7 ngày đổi trả
  HOLD --> REVERSED: hoàn tiền / tranh chấp thắng khách
  ELIGIBLE --> CALCULATED: tạo số tiền supplier và seller
  CALCULATED --> PAYOUT_PENDING: đưa vào đợt chi trả
  PAYOUT_PENDING --> PAID: chuyển tiền thành công
  PAYOUT_PENDING --> PAYOUT_FAILED: lỗi nhận tiền
  PAYOUT_FAILED --> PAYOUT_PENDING: retry hoặc sửa thông tin
  PAID --> [*]
```

---

## 3.5 Stock Reservation (giữ tồn kho)

Quản lý vòng đời giữ tồn kho tạm thời, ngăn chặn triệt để tình trạng bán vượt tồn kho (Overselling) khi nhiều khách mua cùng thời điểm.

```mermaid
stateDiagram-v2
  [*] --> AVAILABLE
  AVAILABLE --> HELD: checkout reserve(quantity, expiresAt)
  HELD --> COMMITTED: thanh toán hợp lệ và supplier accept
  HELD --> RELEASED: thanh toán thất bại / hết TTL / supplier từ chối
  RELEASED --> AVAILABLE: hoàn lại tồn kho khả dụng
  COMMITTED --> ADJUSTED: trả hàng thành công hoặc điều chỉnh kho
  ADJUSTED --> AVAILABLE: nhập lại kho nếu hàng nguyên vẹn
  COMMITTED --> [*]: giao hoàn tất và không đổi trả
```

**Quy tắc:**
- `HELD`: Tồn kho được khóa tạm thời ngay khi tạo đơn; có hạn TTL (15 phút với Online, 24 giờ với COD).
- `COMMITTED`: Trừ vĩnh viễn tồn kho khả dụng khi Supplier xác nhận đơn.
- `RELEASED`: Mở khóa trả lại số lượng cho kho khi đơn bị hủy hoặc quá thời hạn thanh toán.

---

## 3.6 Dispute & Return (khiếu nại và đổi trả)

Vòng đời giải quyết khiếu nại giữa Khách hàng, Nhà cung cấp và sự phân xử của Quản trị viên.

```mermaid
stateDiagram-v2
  [*] --> NONE
  NONE --> REQUESTED: khách mở yêu cầu đổi trả / khiếu nại
  REQUESTED --> EVIDENCE_PENDING: yêu cầu bổ sung video / hình ảnh
  REQUESTED --> UNDER_REVIEW: supplier / sàn tiếp nhận xem xét
  EVIDENCE_PENDING --> UNDER_REVIEW: đã nộp bằng chứng hoặc hết hạn nộp
  UNDER_REVIEW --> APPROVED: supplier / admin chấp thuận
  UNDER_REVIEW --> REJECTED: supplier / admin bác bỏ khiếu nại
  APPROVED --> RETURN_IN_TRANSIT: khách gửi hàng trả về kho
  RETURN_IN_TRANSIT --> RECEIVED: supplier xác nhận nhận hàng trả
  RECEIVED --> REFUND_PENDING: tạo lệnh hoàn tiền
  REFUND_PENDING --> REFUNDED: hoàn tất chi trả
  REJECTED --> CLOSED: đóng khiếu nại
  REFUNDED --> CLOSED: đóng khiếu nại
  CLOSED --> [*]
```

**Quy tắc:**
- Khách hàng chỉ có thể kích hoạt `REQUESTED` khi đơn hàng ở trạng thái `DELIVERED` và chưa quá thời hạn 7 ngày.
- Nếu bị `REJECTED`, đơn hàng quay về trạng thái hoàn tất bình thường và không được mở lại khiếu nại cho cùng lý do.
