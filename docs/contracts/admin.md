# Contract module admin

**Owner:** Người 1. **Status:** Baseline v1.0 cho Pha A. **Consumers:** identity, listings, disputes, fulfillment. Admin quản lý quyết định; module sở hữu dữ liệu thực thi qua port/event.

## Lệnh và quyền

| Lệnh/API v1 | Input | Output | Quyền |
|---|---|---|---|
| POST /api/v1/admin/profiles/{profileId}/decision | role, decision=APPROVED/REJECTED, reasonCode | profileId, approvalStatus, decidedAt | ADMIN |
| POST /api/v1/admin/disputes/{returnRequestId}/decision | decision=APPROVED/REJECTED, reasonCode | returnRequestId, decision, decidedAt | ADMIN |
| GET /api/v1/admin/audit | filter, cursor | audit records đã mask PII | ADMIN |

Identity sở hữu profile approval status. Disputes sở hữu ReturnRequest; Admin gọi public port, không ghi trực tiếp bảng của Identity/Disputes. Một quyết định lặp cùng requestId trả cùng kết quả; quyết định trái ngược sau khi đã khóa trả 409 DECISION_CONFLICT. Mọi quyết định có actorId và audit. Admin xem PII chỉ khi có lý do moderation/support/dispute; export/evidence cũng phải audit.

## Mẫu

    {"role":"SUPPLIER","decision":"APPROVED","reasonCode":"KYC_VERIFIED"}

    {"profileId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","approvalStatus":"APPROVED","decidedAt":"2026-10-01T10:00:00Z"}

    {"error":{"code":"DECISION_CONFLICT","message":"Hồ sơ đã có quyết định khác","details":[]}}

## Event và kiểm chứng

ProfileApproved/ProfileRejected do Identity phát sau commit; DisputeDecisionRecorded do Disputes phát sau commit. Admin không tự phát event thay module owner. Chưa duyệt thì Supplier không tạo Product và Seller không publish Listing. User không phải ADMIN trả 403. Lặp quyết định không tạo audit/event nghiệp vụ thứ hai.
