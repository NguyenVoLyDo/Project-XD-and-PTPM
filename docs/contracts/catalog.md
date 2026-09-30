# Contract điểm nối module catalog → listings/orders

**Owner:** Người 2. **Consumers:** listings (cùng owner), orders của Người 3. **Status:** Baseline v1.0 cho Pha A; review của chủ module chưa được ghi nhận. **Nguồn:** docs/04 Product, docs/07 BR-02/04 và §7.11, docs/09 module ownership.

## Phạm vi

Catalog sở hữu Product nguồn, supplierId, tên Product, trạng thái, giá vốn và dữ liệu tồn gốc. Người 3 chỉ cần dữ liệu để revalidate/snapshot ở checkout; public Cart/Order DTO không được lộ costPrice. Việc hiển thị stock hoặc giữ tồn đi qua Inventory.

## Product snapshot nội bộ v1

    {
      "productId": "77777777-7777-4777-8777-777777777777",
      "supplierId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "productName": "Tai nghe mẫu",
      "productStatus": "ACTIVE",
      "unitCostPrice": 100000,
      "currency": "VND"
    }

unitCostPrice là số nguyên VND theo mục tiêu docs/09; init.sql hiện dùng numeric(14,2), cần migration/mapper thống nhất. Orders lưu unitCostPriceSnapshot sau khi checkout; không đọc lại giá vốn cho OrderItem lịch sử.

## Port v1 cho checkout

Catalog.getProductSnapshots(productIds, txContext) trả Product snapshot nội bộ hoặc lỗi PRODUCT_UNAVAILABLE theo item. Listings là owner của CheckoutQuote tổng hợp và gọi Catalog; Orders chỉ gọi Listings.getCheckoutQuotes.

## Quy tắc

- Chỉ Product ACTIVE và Listing ACTIVE mới có thể checkout; Product hết hàng do Inventory quyết định.
- Seller không sửa supplierId, giá vốn hoặc SKU nguồn.
- Đổi costPrice có thể làm Listing vi phạm margin chuyển PAUSED_BY_POLICY; Orders từ chối checkout mới nhưng OrderItem snapshot cũ không đổi.
- Nội bộ cần đọc Product/Listing trong cùng snapshot/transaction checkout hoặc có cơ chế version/recheck đã thống nhất; không trả giá vốn qua API public.

## Kiểm chứng bàn giao

- Product bị disable sau khi vào Cart → checkout lỗi item-level, không tạo Order.
- Giá vốn thay đổi → snapshot order mới lấy giá hiện hành hợp lệ; order cũ giữ nguyên.
- Customer/Seller public DTO không chứa unitCostPrice.

## Quyết định v1 và nghiệm thu

- ProductStatus dùng DRAFT, ACTIVE, INACTIVE; chỉ ACTIVE có thể checkout. CheckoutQuote tổng hợp thuộc Listings; Catalog không được Orders gọi song song để chắp vá quote.
- Giá vốn VND là số nguyên theo common.md; schema init.sql hiện numeric(14,2), cần migration/mapper trước tích hợp DB.
- Đổi costPrice phải revalidate Listing trong cùng luồng nghiệp vụ; nếu salePrice < costPrice + minMargin thì Listings chuyển PAUSED_BY_POLICY, audit và phát ListingPausedByPolicy.
- Contract test: Product inactive lỗi item-level; public DTO không lộ costPrice; OrderItem cũ không đổi sau cập nhật cost.

## API v1 tối thiểu của Catalog

| API | Quyền | Request/response chính |
|---|---|---|
| POST /api/v1/supplier/products | Supplier APPROVED | name, supplierSku, costPrice, description → productId, status=DRAFT |
| GET /api/v1/supplier/products | Supplier chủ Product | danh sách Product của mình, có costPrice |
| GET /api/v1/supplier/products/{id} | Supplier chủ Product | Product chi tiết |
| PATCH /api/v1/supplier/products/{id} | Supplier chủ Product | tên/mô tả/giá vốn/trạng thái; supplierId và SKU nguồn không đổi qua Seller |
| GET /api/v1/products/{id} | Public | tên/mô tả/trạng thái, không trả costPrice |

Tồn kho ghi qua Inventory, không PATCH availableStock ở Catalog API. Ảnh đi qua storage adapter do Catalog sở hữu, public chỉ thấy URL hợp lệ. Cập nhật costPrice gọi Listings.revalidateByProduct trong cùng transaction/luồng nghiệp vụ; nếu vi phạm margin thì Listing PAUSED_BY_POLICY trước khi API trả thành công.

    {"name":"Tai nghe mẫu","supplierSku":"SUP-001","costPrice":100000,"description":"Mô tả mẫu"}

    {"productId":"77777777-7777-4777-8777-777777777777","supplierId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","status":"DRAFT","currency":"VND"}

Lỗi: 403 không APPROVED/khác owner; 409 SUPPLIER_SKU_EXISTS; 400 INVALID_COST_PRICE; 409 PRODUCT_UNAVAILABLE khi checkout. Test ownership, Seller không đổi cost và cập nhật cost làm pause đúng Listings.
