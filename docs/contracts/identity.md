# Contract điểm nối module identity → cart/orders

**Owner:** Người 1. **Consumers:** common guards, Người 2/3/4 và Admin. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/04 invariant 6, docs/07 BR-01/05, docs/10 handoff, docs/11.

## Phạm vi

Identity cung cấp actor đã xác thực và active role/profile cho request. Cart/Orders không giải mã JWT thủ công, không tin customerId từ request body và không truy vấn bảng user/profile nội bộ của Identity.

## CurrentActor v1

    {
      "userId": "66666666-6666-4666-8666-666666666666",
      "activeRole": "CUSTOMER",
      "activeProfileId": null
    }

- userId: khóa User duy nhất, dùng làm customerId của Cart/CustomerOrder trong schema hiện tại.
- activeRole: vai trò đang thực thi request, không suy một User chỉ có một role.
- activeProfileId: Supplier/Seller profile khi activeRole tương ứng; với Customer là null.
- actorId: userId dùng cho audit. Không dùng profileId làm customer_id.

## Port/guard v1

Identity cung cấp CurrentActorProvider.requireCustomer(requestContext) → CurrentActor đã xác minh. Không có session trả 401; sai activeRole trả 403. Cart/Orders kiểm owner ở truy vấn theo userId.

## Hành vi và lỗi cần khóa

| Tình huống | Kết quả |
|---|---|
| Chưa đăng nhập / token hết hạn | 401, không lộ dữ liệu Cart/Order |
| Đăng nhập vai trò khác nhưng không chọn Customer | 403 ACTIVE_ROLE_REQUIRED; client có thể đổi activeRole qua Identity trước khi gọi lại |
| Customer B biết orderId/cartId của A | 403 FORBIDDEN, không trả nội dung tài nguyên |
| User bị khóa giữa hai request | Session bị vô hiệu trước request nghiệp vụ tiếp theo |

## Ví dụ lỗi (envelope v1)

    {"error":{"code":"FORBIDDEN","message":"Không có quyền truy cập đơn hàng này","details":[]}}

Envelope lỗi và mã FORBIDDEN theo common.md; không ghi token/PII vào log.

## Kiểm chứng bàn giao

- Một User có nhiều role, chọn Customer vẫn thao tác Cart/Order theo đúng userId.
- Request giả userId/customerId trong body/header không đổi owner.
- Customer B không đọc được order của A; API trả đúng mã đã khóa.
- Hết session/role không đúng bị chặn trước xử lý nghiệp vụ.

## Quyết định v1 và nghiệm thu

- CurrentActor = {userId, activeRole, activeProfileId}; actorId audit = userId. User có nhiều role phải chọn activeRole cho request; Supplier/Seller phải có activeProfileId APPROVED đúng quyền.
- JWT/session implementation thuộc Người 1; các module chỉ tiêu thụ CurrentActorProvider, không đọc JWT payload trực tiếp.
- User bị khóa làm session hiện hành vô hiệu trước request nghiệp vụ tiếp theo.
- Contract test: đa vai trò, sai role 403, không session 401, giả customerId trong body không đổi owner, truy cập đơn của người khác 403.

## API v1 tối thiểu của Identity

| API | Request chính | Kết quả | Lỗi chính |
|---|---|---|---|
| POST /api/v1/auth/register | email, password | userId, trạng thái tài khoản | 409 EMAIL_IN_USE |
| POST /api/v1/auth/login | email, password | accessToken, activeRole; refresh token trong HttpOnly cookie | 401 INVALID_CREDENTIALS |
| POST /api/v1/auth/refresh | HttpOnly refresh cookie | accessToken mới và cookie luân phiên | 401 SESSION_EXPIRED |
| POST /api/v1/auth/logout | session hiện tại | 204; revoke refresh session | 401 nếu chưa xác thực |
| GET /api/v1/me | CurrentActor | userId, roles, activeRole, activeProfileId | 401 |
| POST /api/v1/me/active-role | role, profileId nếu Supplier/Seller | CurrentActor mới | 403 PROFILE_NOT_APPROVED |
| POST /api/v1/me/profile-applications | role SUPPLIER/SELLER, thông tin hồ sơ | profileId, approvalStatus=PENDING | 409 PROFILE_ALREADY_EXISTS |

Admin gọi Identity.approveProfile(profileId, decision, reasonCode, txContext) qua port; không ghi bảng profile trực tiếp. Login không tự chọn quyền Supplier/Seller chưa APPROVED. Password dùng Argon2id; refresh token không trả cho JavaScript. Response lỗi dùng common.md.

    {"email":"customer@example.invalid","password":"example-password"}

    {"userId":"66666666-6666-4666-8666-666666666666","roles":["CUSTOMER"],"activeRole":"CUSTOMER","activeProfileId":null}

Test: email trùng, mật khẩu sai, refresh token đã revoke, chuyển vai trò khi profile chưa duyệt, một User có nhiều role và CurrentActor nhất quán.
