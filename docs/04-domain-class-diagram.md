# 4. UML Class Diagram — miền nghiệp vụ

```mermaid
classDiagram
  class User {
    +UUID id
    +string email
    +string passwordHash
    +UserStatus status
  }
  class UserRoleMembership {
    +UUID id
    +RoleType role
    +RoleMembershipStatus status
  }
  class SupplierProfile {
    +UUID id
    +string legalName
    +ApprovalStatus approvalStatus
    +string payoutAccountRef
  }
  class SellerProfile {
    +UUID id
    +string displayName
    +ApprovalStatus approvalStatus
  }
  class Shop {
    +UUID id
    +string name
    +ShopStatus status
  }
  class Product {
    +UUID id
    +string supplierSku
    +string name
    +decimal costPrice
    +int availableStock
    +ProductStatus status
  }
  class Listing {
    +UUID id
    +string sellerSku
    +decimal salePrice
    +ListingStatus status
    +bool visible
  }
  class Cart {
    +UUID id
  }
  class CartItem {
    +int quantity
  }
  class CustomerOrder {
    +UUID id
    +string orderNo
    +OrderStatus status
    +decimal grandTotal
    +FulfillmentSummary fulfillmentSummary
    +decimal totalPayable
    +string currency
    +datetime placedAt
  }
  class OrderItem {
    +int quantity
    +decimal unitSalePriceSnapshot
    +decimal unitCostPriceSnapshot
  }
  class FulfillmentItem {
    +UUID id
    +int quantity
    +decimal itemGrossSnapshot
  }
  class FulfillmentOrder {
    +UUID id
    +string fulfillmentNo
    +FulfillmentStatus status
    +string trackingNo
  }
  class Payment {
    +UUID id
    +PaymentMethod method
    +PaymentStatus status
    +decimal amount
    +string providerTransactionRef
  }
  class Shipment {
    +UUID id
    +string carrierCode
    +string trackingNo
    +ShipmentStatus status
  }
  class Settlement {
    +UUID id
    +SettlementStatus status
    +decimal sellerEarning
    +decimal supplierPayable
    +decimal platformFee
  }
  class Review {
    +UUID id
    +int rating
    +string comment
  }

  User "1" --> "0..1" SupplierProfile : owns
  User "1" --> "0..1" SellerProfile : owns
  User "1" --> "1..*" UserRoleMembership : has roles
  SellerProfile "1" --> "1..*" Shop : manages
  SupplierProfile "1" --> "0..*" Product : supplies
  Product "1" --> "0..*" Listing : source for
  Shop "1" --> "0..*" Listing : publishes
  User "1" --> "0..1" Cart : owns
  Cart "1" --> "1..*" CartItem : contains
  CartItem "*" --> "1" Listing : selects
  User "1" --> "0..*" CustomerOrder : places
  CustomerOrder "1" --> "1..*" OrderItem : contains
  OrderItem "*" --> "1" Listing : snapshot of
  CustomerOrder "1" --> "1..*" FulfillmentOrder : splits into
  FulfillmentOrder "*" --> "1" SupplierProfile : fulfilled by
  FulfillmentOrder "*" --> "1" SellerProfile : sold for
  FulfillmentOrder "1" --> "1..*" FulfillmentItem : contains
  FulfillmentItem "*" --> "1" OrderItem : allocates
  CustomerOrder "1" --> "1..*" Payment : paid by
  Payment "1" --> "1..*" PaymentAllocation : allocates
  PaymentAllocation "*" --> "1" FulfillmentOrder : collects for
  PaymentAllocation "1" --> "0..*" Refund : refunds
  FulfillmentOrder "1" --> "0..1" Shipment : ships via
  FulfillmentOrder "1" --> "0..1" Settlement : settles
  Settlement "1" --> "1..*" FinancialEntry : posts
  User "1" --> "0..*" Review : writes
  Review "*" --> "1" Product : rates
  class PaymentAllocation {
    +UUID id
    +decimal merchandiseAmount
    +decimal shippingAmount
    +decimal discountAmount
    +decimal amountToCollect
    +string currency
    +AllocationStatus status
  }
  class Refund {
    +UUID id
    +decimal amount
    +RefundStatus status
    +string reasonCode
  }
  class FinancialEntry {
    +UUID id
    +FinancialEntryType type
    +decimal amount
    +string currency
    +string sourceRef
    +datetime postedAt
  }
```

## Invariant quan trọng

1. `Listing.salePrice >= Product.costPrice + minMargin` theo chính sách nền tảng.
2. Một `OrderItem` lưu snapshot `unitSalePriceSnapshot` và `unitCostPriceSnapshot` khi checkout thành công.
3. Mỗi `FulfillmentOrder` chỉ thuộc một `SupplierProfile` và một `SellerProfile`.
4. Chỉ `Listing.ACTIVE` của `Product.ACTIVE` mới được thêm vào giỏ.
5. Thay đổi trạng thái fulfillment phải được audit kèm actor, thời điểm và lý do.

6. Role là quan hệ nhiều-nhiều qua `UserRoleMembership`; JWT/request phải chọn active role/profile, không suy ra quyền từ một cột role đơn.
7. Một `FulfillmentItem` phân bổ một `OrderItem` cho đúng một Fulfillment Order; tổng quantity được phân bổ không vượt quantity snapshot của OrderItem.
8. Mỗi PaymentAllocation thuộc đúng một Fulfillment Order; tổng allocation hiệu lực bằng số tiền Customer phải trả. Refund và FinancialEntry chỉ append, phải tham chiếu allocation/source event.
9. Một Fulfillment Order có tối đa một Shipment ở MVP. COD/Settlement của đơn con chỉ hợp lệ khi allocation tương ứng đã được thu hoặc funded.
