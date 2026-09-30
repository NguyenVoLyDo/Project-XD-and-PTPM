# Contract module cart

**Owner:** Người 3. **Consumers:** Customer frontend, module orders. **Status:** Baseline v1.0 cho Pha A. **Nguồn:** docs/04 (Cart/CartItem), docs/07 §7.2, docs/11.

## Phạm vi và dữ liệu

- Một Customer có tối đa một Cart; cùng listingId trong một cart chỉ có một CartItem. quantity là số nguyên dương.
- Cart lưu listingId/quantity và owner; giá, tên và tồn hiển thị là projection từ listings/inventory, **không phải giá được khóa**. Checkout luôn revalidate từ nguồn server.
- Customer chỉ xem/sửa Cart của mình. customerId lấy từ CurrentActor; không nhận từ body.

## API v1

| Method/path | Request | Response | Lỗi |
|---|---|---|---|
| GET /api/v1/cart | Không có body | CartView hoặc cart rỗng | 401, 403 |
| PUT /api/v1/cart/items/{listingId} | {"quantity":2} — đặt số lượng cuối cùng | CartView | 400 INVALID_QUANTITY, 404 LISTING_NOT_FOUND, 409 LISTING_UNAVAILABLE |
| DELETE /api/v1/cart/items/{listingId} | Không có body | CartView | 401, 403 |

PUT lặp với cùng quantity cho cùng kết quả; DELETE lặp vẫn để item vắng mặt. GET không giữ tồn. LISTING_NOT_FOUND là 404; LISTING_UNAVAILABLE là 409.

## DTO mẫu

    {
      "cartId": "11111111-1111-4111-8111-111111111111",
      "items": [
        {
          "listingId": "22222222-2222-4222-8222-222222222222",
          "quantity": 2,
          "title": "Tai nghe mẫu",
          "unitSalePrice": 150000,
          "currency": "VND",
          "availability": "AVAILABLE"
        }
      ],
      "estimatedMerchandiseTotal": 300000,
      "currency": "VND"
    }

title, unitSalePrice, availability là projection từ Listings; availability = AVAILABLE, OUT_OF_STOCK hoặc UNAVAILABLE. estimatedMerchandiseTotal chỉ là tạm tính, chưa gồm ship/discount và không quyết định totalPayable.

## Port với orders

Đề xuất CartReader.getForCheckout(customerId) trả về danh sách bất biến gồm listingId, quantity và cartId/version (nếu có). Orders quyết định revalidation, snapshot và transaction; cart không tạo Order hoặc Reservation.

## Kiểm chứng

- Cùng listing thêm lại không tạo CartItem thứ hai; quantity không hợp lệ bị từ chối.
- Customer B không đọc/sửa Cart của A, kể cả khi biết cartId/listingId.
- Giá thay đổi giữa GET cart và checkout thì checkout dùng giá mới hoặc trả yêu cầu xác nhận lại theo quyết định sản phẩm; không dùng giá tạm tính làm snapshot.
- Listing hết hàng/không ACTIVE được báo tại checkout dù cart cũ còn item.

## Quyết định v1 và nghiệm thu

- Cart chỉ dành cho Customer đã xác thực. Không có anonymous cart trong MVP.
- Không có cart version/ETag ở v1. Checkout dùng Idempotency-Key và đọc Cart hiện hành lần đầu; replay cùng key/body trả response đã lưu.
- Khi giá thay đổi, checkout trả 409 PRICE_CHANGED cùng item hiện hành; Customer phải xác nhận lại. Cart GET vẫn hiển thị giá hiện hành.
- Contract/API mock test: 401 chưa đăng nhập, 403 khác owner, quantity <= 0 trả 400 INVALID_QUANTITY, listing pause trả 409 LISTING_PAUSED_BY_POLICY.
