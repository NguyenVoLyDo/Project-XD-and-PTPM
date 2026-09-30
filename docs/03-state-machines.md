# 3. State machine

## 3.1 Customer Order và trạng thái tổng hợp

`CustomerOrder.status` chỉ quản lý vòng đời checkout. Tiến trình giao hàng hiển thị cho khách là `fulfillmentSummary`, được tính lại từ các `FulfillmentOrder`; đơn con vẫn là nguồn sự thật cho tồn kho, giao hàng, đổi trả và đối soát. Yêu cầu trả hàng và hoàn tiền không làm ghi đè tùy tiện trạng thái của đơn cha.

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> PENDING_PAYMENT: checkout
  PENDING_PAYMENT --> CONFIRMED: paid online / chọn COD
  PENDING_PAYMENT --> PAYMENT_FAILED: payment failed
  PAYMENT_FAILED --> PENDING_PAYMENT: thử thanh toán lại
  PAYMENT_FAILED --> CANCELED: hết hạn thanh toán
  CONFIRMED --> PROCESSING: Supplier bắt đầu xử lý đơn con
  CONFIRMED --> CANCELED: tất cả đơn con bị hủy trước khi giao
  PROCESSING --> CLOSED: mọi đơn con đã có kết quả cuối và không còn case mở
  PROCESSING --> CANCELED: tất cả đơn con bị từ chối/hủy
  CLOSED --> [*]
  CANCELED --> [*]
```

### Quy tắc tổng hợp trạng thái đơn cha

`fulfillmentSummary` là projection, không phải workflow để ghi đè `FulfillmentOrder`.

| Điều kiện trên Fulfillment Order / Return Request | `fulfillmentSummary` |
|---|---|
| Tất cả bị `REJECTED` hoặc `CANCELED` | `CANCELED` |
| Có đơn bị từ chối/hủy và còn đơn chưa có kết quả cuối | `PARTIALLY_CANCELED` |
| Có ít nhất một đơn `DELIVERED`, còn đơn khác đang xử lý | `PARTIALLY_FULFILLED` |
| Có đơn đã giao và có đơn bị hủy hoặc hoàn tiền | `PARTIALLY_COMPLETED` |
| Tất cả đơn giao thành công, còn trong cửa sổ đổi trả | `FULFILLED` |
| Có yêu cầu trả hàng/khiếu nại chưa đóng | `RETURN_IN_PROGRESS` |
| Mọi đơn con đã đóng và hết cửa sổ đổi trả | `COMPLETED` |

`Payment` hiển thị độc lập `PAID`, `PARTIALLY_REFUNDED` hoặc `REFUNDED`; không suy ra các giá trị này chỉ từ `fulfillmentSummary`.

---

## 3.2 Fulfillment Order

Mỗi `FulfillmentOrder` đại diện cho một kiện/mã vận đơn trong MVP theo cặp Supplier – Seller. `deliveryAttemptCount` được lưu và kiểm tra ở server; giao lại chỉ được phép khi số lần giao nhỏ hơn 3.

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
  DELIVERY_FAILED --> IN_TRANSIT: giao lại, attempt < 3
  DELIVERY_FAILED --> RETURNING: return-to-origin, attempt >= 3
  DELIVERED --> RETURN_REQUESTED: ReturnRequest hợp lệ được mở
  RETURN_REQUESTED --> DELIVERED: yêu cầu bị từ chối hoặc rút lại
  RETURN_REQUESTED --> RETURNING: yêu cầu được chấp thuận
  RETURNING --> RETURNED: supplier nhận hàng trả
  RETURNED --> REFUNDED: Refund liên quan hoàn tất
  REJECTED --> [*]
  CANCELED --> [*]
  REFUNDED --> [*]
```

`RETURNING` do giao thất bại là return-to-origin; với COD chưa thu tiền, Payment/Allocation liên quan được `VOIDED`, còn Online đã thu tiền tạo `Refund` theo số tiền đã phân bổ.

---

## 3.3 Payment và Refund

`Payment` theo dõi khoản phải thu; mỗi lần trả tiền lại là một `Refund` riêng có `amount`, `status`, `providerRefundId` và idempotency key. Tổng `Refund.amount` không được vượt số tiền đã thu của Payment/Allocation.

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> AUTHORIZED: cổng thanh toán ủy quyền
  AUTHORIZED --> PAID: capture thành công
  PENDING --> PAID: callback thanh toán thành công
  PENDING --> FAILED: callback thất bại / hết hạn
  PENDING --> PENDING_COD: khách chọn COD
  PENDING_COD --> COLLECTED: carrier xác nhận thu COD
  PENDING_COD --> VOIDED: mọi kiện COD chưa thu bị hủy / return-to-origin
  PAID --> REFUND_PENDING: tạo Refund
  COLLECTED --> REFUND_PENDING: tạo Refund COD
  REFUND_PENDING --> PARTIALLY_REFUNDED: refund thành công, còn số dư
  REFUND_PENDING --> REFUNDED: refund thành công toàn bộ
  REFUND_PENDING --> REFUND_FAILED: refund lỗi
  REFUND_FAILED --> REFUND_PENDING: retry với idempotency key
  PARTIALLY_REFUNDED --> REFUND_PENDING: hoàn tiếp phần còn lại
  PARTIALLY_REFUNDED --> REFUNDED: tổng hoàn tiền đạt số tiền đã thu
  FAILED --> [*]
  VOIDED --> [*]
  REFUNDED --> [*]
```

---

## 3.4 Settlement (đối soát)

```mermaid
stateDiagram-v2
  [*] --> HOLD: Fulfillment Order delivered
  HOLD --> ELIGIBLE: hết cửa sổ đổi trả
  HOLD --> REVERSED: hoàn tiền / tranh chấp thắng khách
  ELIGIBLE --> CALCULATED: tạo supplierPayable và sellerEarning
  CALCULATED --> PAYOUT_PENDING: đưa vào đợt chi trả
  PAYOUT_PENDING --> PAID: chuyển tiền thành công
  PAYOUT_PENDING --> PAYOUT_FAILED: lỗi nhận tiền
  PAYOUT_FAILED --> PAYOUT_PENDING: retry hoặc sửa thông tin
  REVERSED --> [*]
  PAID --> [*]
```

---

## 3.5 Stock Reservation (giữ tồn kho)

`StockReservation` là bản ghi theo `OrderItem`, được tạo trực tiếp ở `HELD`; `AVAILABLE` là thuộc tính của Inventory, không phải trạng thái của reservation. Hàng trả về tạo một `InventoryAdjustment` mới, không tái sử dụng reservation đã `COMMITTED`.

```mermaid
stateDiagram-v2
  [*] --> HELD: reserve(quantity, expiresAt)
  HELD --> COMMITTED: điều kiện thanh toán hợp lệ và supplier accept
  HELD --> RELEASED: payment failed / hết TTL / supplier từ chối / hủy
  COMMITTED --> [*]
  RELEASED --> [*]
```

**Quy tắc:** TTL mặc định MVP là 15 phút với Online chưa thanh toán và 24 giờ với COD chưa được Supplier xác nhận; đây là cấu hình server-side. Commit/release phải nguyên tử và idempotent.

---

## 3.6 Return Request & Dispute

`ReturnRequest` là nguồn sự thật cho đổi trả/khiếu nại, thuộc một `FulfillmentOrder` hoặc `OrderItem`. Cửa sổ đổi trả là `returnWindowDays` cấu hình được; MVP có thể đặt mặc định 7 ngày.

```mermaid
stateDiagram-v2
  [*] --> REQUESTED: khách mở yêu cầu kèm lý do
  REQUESTED --> EVIDENCE_PENDING: yêu cầu bổ sung bằng chứng
  REQUESTED --> UNDER_REVIEW: supplier / sàn tiếp nhận
  EVIDENCE_PENDING --> UNDER_REVIEW: nộp đủ bằng chứng
  EVIDENCE_PENDING --> REJECTED: hết hạn nộp bằng chứng
  UNDER_REVIEW --> APPROVED: supplier / admin chấp thuận
  UNDER_REVIEW --> REJECTED: supplier / admin bác bỏ
  APPROVED --> RETURN_IN_TRANSIT: khách gửi hàng trả
  RETURN_IN_TRANSIT --> RECEIVED: supplier xác nhận nhận hàng
  RECEIVED --> REFUND_PENDING: tạo Refund
  REFUND_PENDING --> REFUNDED: Refund hoàn tất
  REJECTED --> CLOSED: thông báo quyết định
  REFUNDED --> CLOSED: đóng case
  CLOSED --> [*]
```

Không mở lại case cùng `reasonCode` sau khi đã `CLOSED`; mọi transition lưu actor, thời điểm, lý do và nguồn event.