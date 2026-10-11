export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type RoleType = 'CUSTOMER' | 'SELLER' | 'SUPPLIER' | 'ADMIN';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ShopStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED_PRICE_MISMATCH' | 'PAUSED_OUT_OF_STOCK' | 'ARCHIVED';
export type CustomerOrderStatus = 
  | 'DRAFT' 
  | 'PENDING_PAYMENT' 
  | 'PAYMENT_FAILED' 
  | 'CONFIRMED' 
  | 'PROCESSING' 
  | 'CLOSED' 
  | 'CANCELED' 
  | 'PARTIALLY_CANCELED';
export type FulfillmentSummaryStatus = 
  | 'UNFULFILLED' 
  | 'PARTIALLY_FULFILLED' 
  | 'FULFILLED' 
  | 'PARTIALLY_CANCELED' 
  | 'PARTIALLY_COMPLETED' 
  | 'RETURN_IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELED';
export type FulfillmentStatus = 
  | 'PENDING_ACCEPTANCE' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'CANCELED' 
  | 'PACKING' 
  | 'READY_TO_SHIP' 
  | 'SHIPPED' 
  | 'IN_TRANSIT' 
  | 'DELIVERED' 
  | 'DELIVERY_FAILED' 
  | 'RETURN_REQUESTED' 
  | 'RETURNING' 
  | 'RETURNED' 
  | 'REFUNDED';
export type PaymentMethod = 'ONLINE_MOCK' | 'COD';
export type PaymentStatus = 
  | 'PENDING' 
  | 'PAID' 
  | 'PENDING_COD' 
  | 'COLLECTED' 
  | 'PARTIALLY_REFUNDED' 
  | 'REFUNDED' 
  | 'FAILED' 
  | 'VOIDED';
export type AllocationStatus = 'PENDING' | 'FUNDED' | 'COLLECTED' | 'VOIDED' | 'REFUNDED';
export type StockReservationStatus = 'HELD' | 'COMMITTED' | 'RELEASED';
export type SettlementStatus = 'HOLD' | 'ELIGIBLE' | 'CALCULATED' | 'PAYOUT_PENDING' | 'PAID' | 'REVERSED';
export type ReturnRequestStatus = 
  | 'REQUESTED' 
  | 'EVIDENCE_PENDING' 
  | 'UNDER_REVIEW' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'RETURN_IN_TRANSIT' 
  | 'RECEIVED' 
  | 'REFUNDED' 
  | 'CLOSED';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleMembership {
  id: string;
  userId: string;
  role: RoleType;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export interface SupplierProfile {
  id: string;
  userId: string;
  legalName: string;
  approvalStatus: ApprovalStatus;
  payoutAccountRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerProfile {
  id: string;
  userId: string;
  displayName: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Shop {
  id: string;
  sellerId: string;
  name: string;
  status: ShopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  supplierId: string;
  supplierSku: string;
  name: string;
  description: string;
  costPrice: number; // integer VND
  availableStock: number;
  status: ProductStatus;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  productId: string;
  shopId: string;
  sellerSku: string;
  salePrice: number; // integer VND
  status: ListingStatus;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  listingId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrder {
  id: string;
  orderNo: string;
  customerId: string;
  status: CustomerOrderStatus;
  fulfillmentSummary: FulfillmentSummaryStatus;
  currency: string;
  grandTotal: number;
  totalPayable: number;
  shippingAddress: {
    recipientName: string;
    phone: string;
    address: string;
    city: string;
  };
  placedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  customerOrderId: string;
  listingId: string;
  productNameSnapshot: string;
  quantity: number;
  unitSalePriceSnapshot: number;
  unitCostPriceSnapshot: number;
  createdAt: string;
}

export interface FulfillmentOrder {
  id: string;
  fulfillmentNo: string;
  customerOrderId: string;
  supplierId: string;
  sellerId: string;
  status: FulfillmentStatus;
  trackingNo: string | null;
  carrierCode: string;
  currency: string;
  deliveryAttemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentItem {
  id: string;
  fulfillmentOrderId: string;
  orderItemId: string;
  quantity: number;
  itemGrossSnapshot: number;
}

export interface StockReservation {
  id: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  status: StockReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentIntent {
  id: string;
  customerOrderId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  customerOrderId: string;
  paymentIntentId?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  providerTransactionRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  fulfillmentOrderId: string;
  merchandiseAmount: number;
  shippingAmount: number;
  discountAmount: number;
  amountToCollect: number;
  currency: string;
  status: AllocationStatus;
  createdAt: string;
}

export interface Refund {
  id: string;
  paymentAllocationId: string;
  amount: number;
  status: 'PENDING' | 'REFUNDED' | 'FAILED';
  reasonCode: string;
  createdAt: string;
}

export interface Shipment {
  id: string;
  fulfillmentOrderId: string;
  carrierCode: string;
  trackingNo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  fulfillmentOrderId: string;
  status: SettlementStatus;
  sellerEarning: number;
  supplierPayable: number;
  platformFee: number;
  currency: string;
  eligibleAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialEntry {
  id: string;
  settlementId: string;
  type: 'SUPPLIER_PAYABLE' | 'SELLER_EARNING' | 'PLATFORM_FEE' | 'REFUND_DEDUCTION';
  amount: number;
  currency: string;
  sourceRef: string;
  postedAt: string;
}

export interface ReturnRequest {
  id: string;
  fulfillmentOrderId: string;
  orderItemId: string;
  customerId: string;
  reasonCode: string;
  reasonDescription: string;
  evidenceUrls: string[];
  status: ReturnRequestStatus;
  adminDecision?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  metadata?: any;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  read: boolean;
  createdAt: string;
}
