# Contract điểm nối module payments ↔ orders

**Owner:** Người 4. **Consumers:** orders Người 3, fulfillment/disputes/settlements Người 4, notifications Người 1. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/03 §3.3, docs/07 §§7.2/7.8/7.9, docs/08 FR-05/09/10/11, docs/09 §9.9.

## Phạm vi

Payments sở hữu Payment Intent/Attempt, Payment, PaymentAllocation, webhook, refund và trạng thái thu tiền. Orders sở hữu transaction orchestration của checkout, cần yêu cầu Payments tạo intent/allocation trong **cùng transaction** trước commit; gọi provider chỉ sau commit.

## Port checkout v1

Payments.createCheckoutObligation(txContext, orderId, method, allocations[]) nhận mỗi allocation gồm fulfillmentOrderId, merchandiseAmount, shippingAmount, discountAmount, amountToCollect, currency=VND. Trả paymentIntentId/paymentId, allocationIds và trạng thái đầu; không gọi provider trong port transaction này.

    {
      "orderId": "33333333-3333-4333-8333-333333333333",
      "method": "COD",
      "allocations": [
        {
          "fulfillmentOrderId": "44444444-4444-4444-8444-444444444444",
          "merchandiseAmount": 150000,
          "shippingAmount": 0,
          "discountAmount": 0,
          "amountToCollect": 150000,
          "currency": "VND"
        }
      ]
    }

    {
      "paymentId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "paymentIntentId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "status": "PENDING_COD",
      "allocationIds": ["ffffffff-ffff-4fff-8fff-ffffffffffff"]
    }

Ví dụ chỉ có một allocation; checkout đa cặp có N allocations. COD và Online đều có PaymentIntent, Payment và PaymentAllocation record ở v1.

## Bất biến

- Mỗi allocation thuộc đúng một FulfillmentOrder; tổng amountToCollect hiệu lực = CustomerOrder.totalPayable. amountToCollect = merchandiseAmount + shippingAmount - discountAmount.
- VND là số nguyên theo docs/09; init.sql hiện numeric(14,2), cần mapper/migration nhất quán.
- Online mới checkout: Order PENDING_PAYMENT, Payment PENDING, allocation PENDING. Callback hợp lệ → Payment PAID, allocation FUNDED, Order CONFIRMED; StockReservation vẫn HELD tới Supplier accept.
- COD mới checkout: Order CONFIRMED, Payment PENDING_COD, reservation HELD; carrier xác nhận COLLECTED **theo từng FulfillmentOrder/allocation**.
- Đơn con bị reject trước carrier: COD allocation VOIDED, không gọi refund gateway; Online đã thu tiền chỉ refund allocation của đơn con đó.
- Refund/fee/settlement là bút toán append-only có sourceRef; không sửa đè tiền lịch sử.

## Webhook và event

Webhook phải xác minh chữ ký trước xử lý, deduplicate bằng (provider, providerEventId), và cập nhật Payment/ledger/outbox trong transaction. Cùng providerEventId lặp trả thành công, không có side effect thứ hai. Orders nhận event/port trạng thái đã xác minh, không tự nhận callback provider.

PaymentSucceeded, PaymentFailed, RefundCompleted dùng envelope v1 của common; Payments là producer. Orders là owner chuyển CustomerOrder.status khi nhận event idempotent; mỗi transition có sourceRef.

## Lỗi và kiểm chứng

| Tình huống | Hành vi |
|---|---|
| Payment provider timeout sau commit | Payment vẫn PENDING; retry dựa provider/idempotency key, không tạo Order mới |
| Webhook chữ ký sai | Từ chối, audit, không đổi Order/Payment |
| Webhook trùng | Trả thành công, không ledger/refund/outbox trùng |
| Online trả tiền cho hai đơn con, một bị reject | Chỉ refund allocation của đơn bị reject |
| COD hai kiện, một bị reject trước ship | Chỉ void allocation của kiện đó; số phải thu kiện còn lại không đổi |

## Quyết định v1 và nghiệm thu

- Payments.createCheckoutObligation(txContext, orderId, method, allocations[]) tạo Intent/Payment/Allocation trong transaction Orders mở, không gọi provider. Sau commit Online adapter mới tạo payment request; COD không gọi provider.
- Phí ship/discount bằng 0 trong fixture MVP v1; mọi allocation vẫn có snapshot trường này. Orders tính amounts từ quote; Payments kiểm tổng bằng totalPayable và từ chối lệch bằng 409 ALLOCATION_TOTAL_MISMATCH.
- Provider event deduplicate bằng unique (provider, providerEventId) ở provider_events; PaymentAttempt lưu providerTransactionRef. Webhook chữ ký sai không đổi state; trùng event trả 200 không lặp side effect.
- Payments sở hữu job Online pending 15 phút và gọi Orders/Inventory qua public ports; Fulfillment sở hữu COD/accept timeout 24 giờ. Refund có sourceRef/idempotency, không vượt số đã thu của allocation.
- Contract test: Online callback lặp, COD từng kiện, refund một đơn con, payment timeout lặp, allocation sum.

## API/port v1 vận hành thanh toán

| Giao diện | Quyền | Hành vi |
|---|---|---|
| GET /api/v1/payments/{paymentId} | Customer chủ Order hoặc Admin có audit | Payment status và allocations đã mask |
| POST /api/v1/payments/webhooks/{provider} | Provider adapter đã xác minh chữ ký | deduplicate providerEventId, transition Payment/Order qua event |
| Payments.refundAllocation(allocationId, amount, reasonCode, sourceRef) | Disputes/Fulfillment qua port | tạo Refund idempotent, không vượt số đã thu |
| Payments.voidAllocation(allocationId, reasonCode, sourceRef) | Fulfillment qua port | COD chưa thu trở thành VOIDED |
| Payments.getPaymentView(orderId, actor) | Orders qua port | payment status cho Customer Order view |

Webhook không dùng CurrentActor của Customer; phải xác minh chữ ký provider và giữ payload có kiểm soát. Test webhook sai chữ ký, trùng event, Online refund một allocation, COD void trước ship và sourceRef trùng. PaymentAttempt/provider_event_id khác transactionRef; provider_events(provider,provider_event_id) là khóa dedup.
