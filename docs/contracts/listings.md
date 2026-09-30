# Contract điểm nối module listings → cart/orders

**Owner:** Người 2. **Consumers:** Storefront/Cart/Orders của Người 3. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/04 Listing, docs/07 BR-03/04 và §7.11, docs/10 handoff, docs/08 FR-03/12.

## Phạm vi

Listings sở hữu Shop/Listing, giá bán và trạng thái publish. Checkout cần một quote nội bộ đã xác minh gồm Listing + Product + Supplier + Seller tại cùng thời điểm; không ghép dữ liệu từ các response public để tạo order.

## Public ListingView v1

    {
      "listingId": "22222222-2222-4222-8222-222222222222",
      "productId": "77777777-7777-4777-8777-777777777777",
      "shopId": "88888888-8888-4888-8888-888888888888",
      "sellerId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "title": "Tai nghe mẫu",
      "salePrice": 150000,
      "currency": "VND",
      "status": "ACTIVE",
      "canPurchase": true
    }

Public view không chứa giá vốn, reservation hoặc PII. Danh sách/tìm kiếm/chi tiết Listing là API Người 2 định nghĩa; Người 3 chỉ cần field/filter/pagination được khóa để dựng Storefront.

## CheckoutQuote nội bộ v1

    {
      "listingId": "22222222-2222-4222-8222-222222222222",
      "productId": "77777777-7777-4777-8777-777777777777",
      "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "sellerId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "productName": "Tai nghe mẫu",
      "listingTitle": "Tai nghe mẫu",
      "unitSalePrice": 150000,
      "unitCostPrice": 100000,
      "currency": "VND",
      "status": "ACTIVE"
    }

Listings.getCheckoutQuotes(listingIds, txContext) là port v1. Listings kiểm Listing/Product ACTIVE, Supplier/Seller APPROVED, Shop ACTIVE và margin; Orders nhận quote hợp lệ. Inventory kiểm số lượng trong cùng transaction.

## Lỗi và thay đổi

| Tình huống | Kết quả v1 |
|---|---|
| Listing không tồn tại | LISTING_NOT_FOUND, item-level |
| Listing/Product không ACTIVE hoặc policy pause | LISTING_PAUSED_BY_POLICY / LISTING_UNAVAILABLE, item-level |
| Giá thay đổi giữa Cart và Checkout | 409 PRICE_CHANGED với item và giá hiện hành; Customer xác nhận lại bằng request mới |
| Đổi giá vốn làm salePrice dưới margin | Listing chuyển PAUSED_BY_POLICY, audit/notification; order cũ không đổi |

PAUSED_BY_POLICY là enum v1. canPurchase không bảo đảm còn tồn; Inventory quyết định stock.

## Kiểm chứng bàn giao

- Cùng Product của một Supplier được hai Seller bán ở hai Listing/giá khác nhau.
- Quote checkout trả đúng supplierId/sellerId của từng Listing; split theo cặp.
- Product/Shop/Supplier/Seller không hợp lệ bị từ chối dù Listing record còn ACTIVE.
- Public DTO không lộ costPrice.

## Quyết định v1 và nghiệm thu

- Public API v1: GET /api/v1/listings (filter/search/pagination), GET /api/v1/listings/{listingId}. Chi tiết filter/cursor có thể mở rộng tương thích; DTO tối thiểu là ListingView trong file này.
- CheckoutQuote nội bộ lấy qua getCheckoutQuotes(listingIds, txContext); cùng quote được dùng snapshot và split. Không trả unitCostPrice ra public API.
- ListingStatus v1: DRAFT, ACTIVE, PAUSED_BY_POLICY, INACTIVE. minMargin là khoản VND cấu hình, mặc định 0 cho mock; điều kiện salePrice >= costPrice + minMargin.
- Lỗi item-level: LISTING_NOT_FOUND (404), LISTING_UNAVAILABLE (409), LISTING_PAUSED_BY_POLICY (409), PRICE_CHANGED (409). Khi Product cost đổi và vi phạm margin, phát ListingPausedByPolicy qua outbox.

## API v1 quản lý Shop/Listing

| API | Quyền | Request/response chính |
|---|---|---|
| POST /api/v1/seller/shops | Seller APPROVED | name → shopId, status=DRAFT |
| PATCH /api/v1/seller/shops/{id} | Seller chủ Shop | name/status |
| POST /api/v1/seller/listings | Seller APPROVED, Shop ACTIVE | productId, shopId, salePrice, sellerSku? → listingId, status=DRAFT |
| PATCH /api/v1/seller/listings/{id} | Seller chủ Listing | salePrice/nội dung cho phép |
| POST /api/v1/seller/listings/{id}/publish | Seller chủ Listing | status=ACTIVE hoặc 409 MIN_MARGIN_VIOLATION |
| GET /api/v1/listings | Public | filter/search/pagination, ListingView không có costPrice |
| GET /api/v1/listings/{id} | Public | ListingView và Product public |

Listing chỉ ACTIVE khi Product ACTIVE, Supplier/Seller APPROVED, Shop ACTIVE và salePrice >= costPrice + minMargin. Event ListingPausedByPolicy có listingId/productId/sellerId, không chứa costPrice công khai. Khi giá thay đổi sau Cart, Orders trả PRICE_CHANGED.

    {"productId":"77777777-7777-4777-8777-777777777777","shopId":"88888888-8888-4888-8888-888888888888","salePrice":150000}

    {"listingId":"22222222-2222-4222-8222-222222222222","status":"DRAFT","currency":"VND"}

Lỗi: 403 khác owner/chưa duyệt; 404 PRODUCT_NOT_FOUND; 409 MIN_MARGIN_VIOLATION, LISTING_PAUSED_BY_POLICY hoặc SHOP_INACTIVE. Test hai Seller bán cùng Product với giá riêng.
