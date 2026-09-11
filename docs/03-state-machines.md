# 3. State machine

## 3.1 Customer Order

`Customer Order` là trạng thái tổng hợp ở góc nhìn khách hàng. Nó chỉ `COMPLETED` khi mọi `Fulfillment Order` hoàn tất; `PARTIALLY_*` khi các đơn con có kết quả khác nhau.

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
  PARTIALLY_FULFILLED --> FULFILLED: tất cả đơn con delivered
  PARTIALLY_FULFILLED --> PARTIALLY_CANCELED: có đơn con canceled
  FULFILLED --> COMPLETED: hết cửa sổ đổi trả
  FULFILLED --> RETURN_REQUESTED: khách yêu cầu trả hàng
  RETURN_REQUESTED --> REFUNDED: hoàn tiền hoàn tất
  PROCESSING --> PARTIALLY_CANCELED: một đơn con canceled
  PARTIALLY_CANCELED --> CANCELED: tất cả đơn con canceled
```

## 3.2 Fulfillment Order

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
  DELIVERY_FAILED --> IN_TRANSIT: giao lại
  DELIVERY_FAILED --> RETURNING: hoàn về supplier
  DELIVERED --> RETURN_REQUESTED: yêu cầu đổi trả được mở
  RETURN_REQUESTED --> RETURNING: chấp nhận trả hàng
  RETURNING --> RETURNED: supplier nhận hàng trả
  RETURNED --> REFUNDED: hoàn tiền hoàn tất
  REJECTED --> [*]
  CANCELED --> [*]
  REFUNDED --> [*]
```

## 3.3 Payment

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> AUTHORIZED: cổng thanh toán ủy quyền
  AUTHORIZED --> PAID: capture thành công
  PENDING --> PAID: callback thanh toán thành công
  PENDING --> FAILED: callback thất bại / hết hạn
  PENDING --> PENDING_COD: khách chọn COD
  PENDING_COD --> COLLECTED: carrier xác nhận thu COD
  PAID --> REFUND_PENDING: hủy / hoàn hàng được duyệt
  COLLECTED --> REFUND_PENDING: hoàn tiền COD theo quy trình
  REFUND_PENDING --> REFUNDED: gateway / admin xác nhận
  REFUND_PENDING --> REFUND_FAILED: hoàn tiền lỗi
  REFUND_FAILED --> REFUND_PENDING: retry
```

## 3.4 Settlement (đối soát)

```mermaid
stateDiagram-v2
  [*] --> HOLD: đơn delivered
  HOLD --> ELIGIBLE: hết thời hạn đổi trả
  HOLD --> REVERSED: hoàn tiền / tranh chấp thắng khách
  ELIGIBLE --> CALCULATED: tạo số tiền supplier và seller
  CALCULATED --> PAYOUT_PENDING: đưa vào đợt chi trả
  PAYOUT_PENDING --> PAID: chuyển tiền thành công
  PAYOUT_PENDING --> PAYOUT_FAILED: lỗi nhận tiền
  PAYOUT_FAILED --> PAYOUT_PENDING: retry hoặc sửa thông tin
```
