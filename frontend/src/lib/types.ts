export type RoleType = 'CUSTOMER' | 'SELLER' | 'SUPPLIER' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  role: RoleType;
  roles: RoleType[];
  supplierProfile?: {
    id: string;
    legalName: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    payoutAccountRef: string | null;
  };
  sellerProfile?: {
    id: string;
    displayName: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  };
}

export interface ListingItem {
  id: string;
  productId: string;
  shopId: string;
  sellerSku: string;
  salePrice: number;
  costPrice: number;
  status: 'ACTIVE' | 'PAUSED_PRICE_MISMATCH' | 'PAUSED_OUT_OF_STOCK' | 'ARCHIVED';
  visible: boolean;
  productName: string;
  productDescription: string;
  productImage: string;
  availableStock: number;
  shopName: string;
  supplierName: string;
  sellerName: string;
  supplierId: string;
  sellerId: string;
}

export interface CartItemView {
  id: string;
  listingId: string;
  quantity: number;
  salePrice: number;
  subtotal: number;
  productName: string;
  productImage: string;
  supplierId: string;
  supplierName: string;
  sellerId: string;
  shopName: string;
  availableStock: number;
}

export interface FulfillmentOrderView {
  id: string;
  fulfillmentNo: string;
  supplierId: string;
  sellerId: string;
  supplierName: string;
  sellerName: string;
  status: string;
  trackingNo: string | null;
  carrierCode: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitSalePrice: number;
    unitCostPrice?: number;
    itemGrossSnapshot: number;
  }[];
  allocation?: {
    merchandiseAmount: number;
    shippingAmount: number;
    amountToCollect: number;
    status: string;
  };
  shippingAddress?: {
    recipientName: string;
    phone: string;
    address: string;
    city: string;
  };
}

export interface CustomerOrderView {
  id: string;
  orderNo: string;
  customerId: string;
  status: string;
  fulfillmentSummary: string;
  grandTotal: number;
  totalPayable: number;
  shippingAddress: {
    recipientName: string;
    phone: string;
    address: string;
    city: string;
  };
  placedAt: string;
  items: {
    id: string;
    listingId: string;
    productNameSnapshot: string;
    quantity: number;
    unitSalePriceSnapshot: number;
  }[];
  fulfillmentOrders: FulfillmentOrderView[];
  payments: {
    id: string;
    method: string;
    status: string;
    amount: number;
    providerTransactionRef: string;
  }[];
}

export interface NotificationView {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  read: boolean;
  createdAt: string;
}
