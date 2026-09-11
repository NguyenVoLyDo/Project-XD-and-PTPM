# 6. Component architecture và ERD

## 6.1 Component diagram

```mermaid
flowchart TB
  subgraph Clients[Client applications]
    Storefront[Customer Storefront]
    SellerPortal[Seller Portal]
    SupplierPortal[Supplier Portal]
    AdminPortal[Admin Portal]
  end

  subgraph Platform[DropConnect Platform]
    API[API Gateway / Auth RBAC]
    Identity[Identity Service]
    Catalog[Catalog and Listing Service]
    Cart[Cart Service]
    Orders[Order Orchestrator]
    Fulfillment[Fulfillment Service]
    Payments[Payment Service]
    Settlement[Settlement Service]
    Notify[Notification Service]
    Audit[Audit and Dispute Service]
    DB[(PostgreSQL)]
    Queue[(Event Queue)]
    Storage[(Object Storage)]
  end

  subgraph External[External systems]
    Gateway[Payment Gateway]
    Carrier[Carrier API]
    Mail[Email/SMS/Push Provider]
  end

  Storefront & SellerPortal & SupplierPortal & AdminPortal --> API
  API --> Identity & Catalog & Cart & Orders & Fulfillment & Payments & Settlement & Audit
  Catalog --> Storage
  Identity & Catalog & Cart & Orders & Fulfillment & Payments & Settlement & Audit --> DB
  Orders --> Queue
  Fulfillment --> Queue
  Payments --> Queue
  Queue --> Notify & Settlement
  Payments <--> Gateway
  Fulfillment <--> Carrier
  Notify --> Mail
```

## 6.2 ERD dữ liệu cốt lõi

```mermaid
erDiagram
  USERS ||--o| SUPPLIER_PROFILES : has
  USERS ||--o| SELLER_PROFILES : has
  SELLER_PROFILES ||--|{ SHOPS : manages
  SUPPLIER_PROFILES ||--|{ PRODUCTS : supplies
  PRODUCTS ||--|{ LISTINGS : source_for
  SHOPS ||--|{ LISTINGS : publishes
  USERS ||--o| CARTS : owns
  CARTS ||--|{ CART_ITEMS : contains
  LISTINGS ||--o{ CART_ITEMS : selected_as
  USERS ||--|{ CUSTOMER_ORDERS : places
  CUSTOMER_ORDERS ||--|{ ORDER_ITEMS : contains
  LISTINGS ||--o{ ORDER_ITEMS : snapshot_from
  CUSTOMER_ORDERS ||--|{ FULFILLMENT_ORDERS : split_into
  SUPPLIER_PROFILES ||--|{ FULFILLMENT_ORDERS : fulfills
  SELLER_PROFILES ||--|{ FULFILLMENT_ORDERS : sells_for
  FULFILLMENT_ORDERS ||--|{ FULFILLMENT_ITEMS : contains
  ORDER_ITEMS ||--o{ FULFILLMENT_ITEMS : allocated_to
  CUSTOMER_ORDERS ||--|{ PAYMENTS : paid_by
  FULFILLMENT_ORDERS ||--o| SHIPMENTS : has
  FULFILLMENT_ORDERS ||--o| SETTLEMENTS : generates
  USERS ||--|{ REVIEWS : writes
  PRODUCTS ||--o{ REVIEWS : receives

  USERS {
    uuid id PK
    string email UK
    string role
    string status
  }
  PRODUCTS {
    uuid id PK
    uuid supplier_id FK
    string supplier_sku
    decimal cost_price
    int available_stock
    string status
  }
  LISTINGS {
    uuid id PK
    uuid product_id FK
    uuid shop_id FK
    decimal sale_price
    string status
  }
  CUSTOMER_ORDERS {
    uuid id PK
    string order_no UK
    uuid customer_id FK
    decimal grand_total
    string status
  }
  ORDER_ITEMS {
    uuid id PK
    uuid order_id FK
    uuid listing_id FK
    int quantity
    decimal unit_sale_price_snapshot
    decimal unit_cost_price_snapshot
  }
  FULFILLMENT_ORDERS {
    uuid id PK
    uuid customer_order_id FK
    uuid supplier_id FK
    uuid seller_id FK
    string status
  }
  PAYMENTS {
    uuid id PK
    uuid customer_order_id FK
    string method
    string status
    decimal amount
    string transaction_ref UK
  }
  SHIPMENTS {
    uuid id PK
    uuid fulfillment_order_id FK
    string tracking_no UK
    string status
  }
  SETTLEMENTS {
    uuid id PK
    uuid fulfillment_order_id FK
    decimal supplier_payable
    decimal seller_earning
    string status
  }
```

## 6.3 Event chính

| Event | Producer | Consumer | Mục đích |
|---|---|---|---|
| `OrderConfirmed` | Order Service | Notification, Fulfillment | Báo supplier/seller và khởi tạo xử lý đơn |
| `PaymentSucceeded` | Payment Service | Order, Audit | Xác nhận đơn online, ghi audit |
| `FulfillmentShipped` | Fulfillment Service | Notification, Order | Đồng bộ tracking và trạng thái tổng |
| `FulfillmentDelivered` | Fulfillment/Carrier webhook | Order, Settlement, Notification | Đánh dấu giao thành công, bắt đầu hold đối soát |
| `RefundCompleted` | Payment Service | Order, Settlement, Notification | Cập nhật hoàn tiền và đảo đối soát nếu cần |
| `SettlementEligible` | Settlement Service | Payout job | Đưa đơn vào đợt chi trả |
