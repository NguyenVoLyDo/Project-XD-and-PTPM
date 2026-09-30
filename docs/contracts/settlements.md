# Contract module settlements

**Owner:** Người 4. **Status:** Baseline v1.0 cho Pha A. **Consumers:** Supplier/Seller finance portal, admin, payments/disputes/fulfillment.

## Điều kiện và dữ liệu

- Settlement thuộc một FulfillmentOrder. Chỉ xét sau DELIVERED, allocation tương ứng FUNDED (Online) hoặc COLLECTED (COD), không có dispute mở và đã hết returnWindowDays (MVP mặc định 7 ngày sau DELIVERED).
- Các trạng thái: HOLD → ELIGIBLE → CALCULATED → PAYOUT_PENDING → PAID; refund/dispute có thể dẫn tới REVERSED; payout lỗi thành PAYOUT_FAILED rồi retry an toàn.
- supplierPayable = tổng unitCostPriceSnapshot × quantity của fulfillment sau các adjustment. sellerEarning = lineSaleTotal - supplierPayable - platformFee - sellerShippingShare - refundAdjustment. MVP dùng platformFee=0, sellerShippingShare=0 nếu chưa có chính sách phí; vẫn lưu snapshot/FinancialEntry để mở rộng sau.
- FinancialEntry append-only. Mỗi nghiệp vụ tài chính tạo ít nhất một cặp DEBIT/CREDIT cùng transactionGroupRef; tổng DEBIT = tổng CREDIT theo group. Mỗi leg có accountCode, direction, amountVnd nguyên dương và sourceRef duy nhất (businessSourceRef:legIndex). Refund/adjustment tạo group mới, không sửa entry cũ. init.sql thiếu transactionGroupRef/accountCode/direction; migration phải bổ sung trước DB integration.

## Port/API v1

Settlement.evaluateEligibility(fulfillmentOrderId, now, sourceRef) idempotent. Settlement.recordAdjustment(allocationId, amount, reasonCode, sourceRef) idempotent. GET /api/v1/supplier/finance và /api/v1/seller/finance lọc theo activeProfileId, trả tiền của đúng vai trò; seller không xem giá vốn Supplier nếu không được phép.

    {"fulfillmentOrderId":"44444444-4444-4444-8444-444444444444","allocationId":"ffffffff-ffff-4fff-8fff-ffffffffffff","status":"HOLD","supplierPayable":100000,"sellerEarning":50000,"platformFee":0,"currency":"VND"}

    {"error":{"code":"SETTLEMENT_NOT_ELIGIBLE","message":"Khoản đối soát chưa đủ điều kiện","details":[]}}

## Event và kiểm chứng

FulfillmentDelivered/RefundCompleted/DisputeDecisionRecorded là input; SettlementEligible là output sau commit. Job lặp không tạo Settlement/FinancialEntry/Payout thứ hai. Một đơn con bị reject không mở eligibility và không ảnh hưởng đơn con còn lại. Payout thật nằm ngoài MVP; payout mock phải có idempotency key/sourceRef.
