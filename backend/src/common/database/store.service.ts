import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { CommerceDb } from '../../integration/postgres/commerce-db';
import {
  User,
  UserRoleMembership,
  SupplierProfile,
  SellerProfile,
  Shop,
  Product,
  Listing,
  Cart,
  CartItem,
  CustomerOrder,
  OrderItem,
  FulfillmentOrder,
  FulfillmentItem,
  StockReservation,
  Payment,
  PaymentAllocation,
  Refund,
  Shipment,
  Settlement,
  FinancialEntry,
  ReturnRequest,
  AuditLog,
  NotificationItem,
} from './types';

@Injectable()
export class StoreService implements OnModuleInit {
  users: User[] = [];
  userRoles: UserRoleMembership[] = [];
  supplierProfiles: SupplierProfile[] = [];
  sellerProfiles: SellerProfile[] = [];
  shops: Shop[] = [];
  products: Product[] = [];
  listings: Listing[] = [];
  carts: Cart[] = [];
  cartItems: CartItem[] = [];
  customerOrders: CustomerOrder[] = [];
  orderItems: OrderItem[] = [];
  fulfillmentOrders: FulfillmentOrder[] = [];
  fulfillmentItems: FulfillmentItem[] = [];
  stockReservations: StockReservation[] = [];
  payments: Payment[] = [];
  paymentAllocations: PaymentAllocation[] = [];
  refunds: Refund[] = [];
  shipments: Shipment[] = [];
  settlements: Settlement[] = [];
  financialEntries: FinancialEntry[] = [];
  returnRequests: ReturnRequest[] = [];
  auditLogs: AuditLog[] = [];
  notifications: NotificationItem[] = [];
  idempotencyKeys: Map<string, { requestHash: string; responseBody: any }> = new Map();

  constructor(
    @Optional()
    @Inject(CommerceDb)
    private readonly db?: CommerceDb,
  ) {}

  async onModuleInit() {
    this.seedInitialData();
    await this.syncFromPostgres().catch(() => {});
  }

  async syncFromPostgres() {
    if (!this.db) return;
    try {
      // 1. Sync accounts & profiles
      const users = await this.db.query('SELECT * FROM users');
      for (const u of users) {
        if (!this.users.some(existing => existing.id === u.id || existing.email === u.email)) {
          this.users.push({
            id: u.id,
            email: u.email,
            passwordHash: u.password_hash,
            status: u.status,
            createdAt: u.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: u.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        }
      }

      const memberships = await this.db.query('SELECT * FROM user_role_memberships');
      for (const m of memberships) {
        if (!this.userRoles.some(existing => existing.userId === m.user_id && existing.role === m.role)) {
          this.userRoles.push({
            id: m.id || crypto.randomUUID(),
            userId: m.user_id,
            role: m.role,
            status: m.status,
            createdAt: m.created_at?.toISOString?.() || new Date().toISOString(),
          });
        }
      }

      const supplierProfiles = await this.db.query('SELECT * FROM supplier_profiles');
      for (const sp of supplierProfiles) {
        if (!this.supplierProfiles.some(existing => existing.id === sp.id)) {
          this.supplierProfiles.push({
            id: sp.id,
            userId: sp.user_id,
            legalName: sp.legal_name,
            approvalStatus: sp.approval_status,
            payoutAccountRef: sp.payout_account_ref || '',
            createdAt: sp.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: sp.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        }
      }

      const sellerProfiles = await this.db.query('SELECT * FROM seller_profiles');
      for (const sp of sellerProfiles) {
        if (!this.sellerProfiles.some(existing => existing.id === sp.id)) {
          this.sellerProfiles.push({
            id: sp.id,
            userId: sp.user_id,
            displayName: sp.display_name,
            approvalStatus: sp.approval_status,
            createdAt: sp.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: sp.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        }
      }

      // 2. Sync products & listings
      const products = await this.db.query('SELECT * FROM products');
      for (const p of products) {
        const existing = this.products.find(item => item.id === p.id);
        if (!existing) {
          this.products.push({
            id: p.id,
            supplierId: p.supplier_id,
            supplierSku: p.supplier_sku,
            name: p.name,
            description: p.description || '',
            costPrice: Number(p.cost_price),
            availableStock: p.available_stock,
            status: p.status,
            createdAt: p.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: p.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        } else {
          existing.availableStock = p.available_stock;
          existing.status = p.status;
        }
      }

      // 3. Sync customer orders
      const orders = await this.db.query('SELECT * FROM customer_orders');
      for (const o of orders) {
        const existing = this.customerOrders.find(co => co.id === o.id);
        const snap = o.snapshot;
        if (!existing) {
          this.customerOrders.push({
            id: o.id,
            orderNo: o.order_no,
            customerId: o.customer_id,
            status: o.status,
            fulfillmentSummary: o.fulfillment_summary,
            shippingAddress: snap?.order?.shippingAddress || { recipientName: 'Khách hàng', phone: '', address: '', city: '' },
            grandTotal: Number(o.grand_total),
            totalPayable: Number(o.total_payable),
            currency: o.currency || 'VND',
            placedAt: o.placed_at?.toISOString?.() || o.placed_at || o.created_at,
            createdAt: o.created_at?.toISOString?.() || o.created_at,
            updatedAt: o.updated_at?.toISOString?.() || o.updated_at,
          });
        } else {
          existing.status = o.status;
          existing.fulfillmentSummary = o.fulfillment_summary;
          existing.totalPayable = Number(o.total_payable);
          existing.updatedAt = o.updated_at?.toISOString?.() || o.updated_at;
        }
      }

      // 4. Sync order items
      const orderItems = await this.db.query('SELECT * FROM order_items');
      for (const oi of orderItems) {
        if (!this.orderItems.some(existing => existing.id === oi.id)) {
          this.orderItems.push({
            id: oi.id,
            customerOrderId: oi.customer_order_id,
            listingId: oi.listing_id,
            productNameSnapshot: oi.product_name_snapshot,
            quantity: oi.quantity,
            unitSalePriceSnapshot: Number(oi.unit_sale_price_snapshot),
            unitCostPriceSnapshot: Number(oi.unit_cost_price_snapshot),
            createdAt: oi.created_at?.toISOString?.() || new Date().toISOString(),
          });
        }
      }

      // 5. Sync fulfillment orders
      const fos = await this.db.query('SELECT * FROM fulfillment_orders');
      for (const fo of fos) {
        const existing = this.fulfillmentOrders.find(f => f.id === fo.id);
        if (!existing) {
          this.fulfillmentOrders.push({
            id: fo.id,
            fulfillmentNo: fo.fulfillment_no,
            customerOrderId: fo.customer_order_id,
            supplierId: fo.supplier_id,
            sellerId: fo.seller_id,
            status: fo.status,
            carrierCode: fo.carrier_code || 'GHN_EXPRESS',
            trackingNo: fo.tracking_no || null,
            currency: fo.currency || 'VND',
            deliveryAttemptCount: fo.delivery_attempt_count || 0,
            createdAt: fo.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: fo.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        } else {
          existing.status = fo.status;
          existing.carrierCode = fo.carrier_code || existing.carrierCode;
          existing.trackingNo = fo.tracking_no || existing.trackingNo;
          existing.updatedAt = fo.updated_at?.toISOString?.() || fo.updated_at;
        }
      }

      // 6. Sync fulfillment items
      const fis = await this.db.query('SELECT * FROM fulfillment_items');
      for (const fi of fis) {
        if (!this.fulfillmentItems.some(existing => existing.fulfillmentOrderId === fi.fulfillment_order_id && existing.orderItemId === fi.order_item_id)) {
          this.fulfillmentItems.push({
            id: fi.id || crypto.randomUUID(),
            fulfillmentOrderId: fi.fulfillment_order_id,
            orderItemId: fi.order_item_id,
            quantity: fi.quantity,
            itemGrossSnapshot: Number(fi.item_gross_snapshot),
          });
        }
      }

      // 7. Sync stock reservations
      const reservations = await this.db.query('SELECT * FROM stock_reservations');
      for (const res of reservations) {
        const existing = this.stockReservations.find(r => r.id === res.id || r.orderItemId === res.order_item_id);
        if (!existing) {
          this.stockReservations.push({
            id: res.id,
            orderItemId: res.order_item_id,
            productId: res.product_id,
            quantity: res.quantity,
            status: res.status,
            expiresAt: res.expires_at?.toISOString?.() || res.expires_at,
            createdAt: res.created_at?.toISOString?.() || new Date().toISOString(),
          });
        } else {
          existing.status = res.status;
        }
      }

      // 8. Sync payments & payment allocations
      const payments = await this.db.query('SELECT * FROM payments');
      for (const p of payments) {
        const existing = this.payments.find(pay => pay.id === p.id);
        if (!existing) {
          this.payments.push({
            id: p.id,
            customerOrderId: p.customer_order_id,
            paymentIntentId: p.payment_intent_id || '',
            method: p.method,
            status: p.status,
            amount: Number(p.amount),
            providerTransactionRef: p.provider_transaction_ref || '',
            createdAt: p.created_at?.toISOString?.() || new Date().toISOString(),
            updatedAt: p.updated_at?.toISOString?.() || new Date().toISOString(),
          });
        } else {
          existing.status = p.status;
          existing.providerTransactionRef = p.provider_transaction_ref || existing.providerTransactionRef;
          existing.updatedAt = p.updated_at?.toISOString?.() || p.updated_at;
        }
      }

      const allocs = await this.db.query('SELECT * FROM payment_allocations');
      for (const a of allocs) {
        const existing = this.paymentAllocations.find(pa => pa.id === a.id);
        if (!existing) {
          this.paymentAllocations.push({
            id: a.id,
            paymentId: a.payment_id,
            fulfillmentOrderId: a.fulfillment_order_id,
            merchandiseAmount: Number(a.merchandise_amount),
            shippingAmount: Number(a.shipping_amount),
            discountAmount: Number(a.discount_amount),
            amountToCollect: Number(a.amount_to_collect),
            currency: 'VND',
            status: a.status,
            createdAt: a.created_at?.toISOString?.() || new Date().toISOString(),
          });
        } else {
          existing.status = a.status;
        }
      }
    } catch {
      // Non-blocking in non-postgres test environments
    }
  }

  generateUuid(): string {
    return crypto.randomUUID();
  }

  logAudit(actorId: string | null, action: string, entityType: string, entityId: string | null, reason: string | null = null, metadata: any = null) {
    const log: AuditLog = {
      id: this.generateUuid(),
      actorId,
      action,
      entityType,
      entityId,
      reason,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  sendNotification(recipientUserId: string, title: string, message: string, type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO') {
    const notif: NotificationItem = {
      id: this.generateUuid(),
      recipientUserId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(notif);
    return notif;
  }

  seedInitialData() {
    const now = new Date().toISOString();

    // 1. Users
    // Passwords for demo: '123456'
    const adminUser: User = {
      id: 'u-admin-1',
      email: 'admin@dropconnect.vn',
      passwordHash: '123456',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const supplierAUser: User = {
      id: 'u-supplier-a',
      email: 'suppliera@phukienviet.vn',
      passwordHash: '123456',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const supplierBUser: User = {
      id: 'u-supplier-b',
      email: 'supplierb@giadungviet.vn',
      passwordHash: '123456',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const sellerXUser: User = {
      id: 'u-seller-x',
      email: 'sellerx@techstore.vn',
      passwordHash: '123456',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const customerCUser: User = {
      id: 'u-customer-c',
      email: 'customer@gmail.com',
      passwordHash: '123456',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.users = [adminUser, supplierAUser, supplierBUser, sellerXUser, customerCUser];

    // 2. Roles
    this.userRoles = [
      { id: this.generateUuid(), userId: adminUser.id, role: 'ADMIN', status: 'ACTIVE', createdAt: now },
      { id: this.generateUuid(), userId: supplierAUser.id, role: 'SUPPLIER', status: 'ACTIVE', createdAt: now },
      { id: this.generateUuid(), userId: supplierBUser.id, role: 'SUPPLIER', status: 'ACTIVE', createdAt: now },
      { id: this.generateUuid(), userId: sellerXUser.id, role: 'SELLER', status: 'ACTIVE', createdAt: now },
      { id: this.generateUuid(), userId: customerCUser.id, role: 'CUSTOMER', status: 'ACTIVE', createdAt: now },
    ];

    // 3. Profiles
    const supplierAProf: SupplierProfile = {
      id: 'prof-supp-a',
      userId: supplierAUser.id,
      legalName: 'Công ty TNHH Phụ Kiện Số Việt Nam',
      approvalStatus: 'APPROVED',
      payoutAccountRef: 'MBBank-0987654321',
      createdAt: now,
      updatedAt: now,
    };
    const supplierBProf: SupplierProfile = {
      id: 'prof-supp-b',
      userId: supplierBUser.id,
      legalName: 'Tổng Kho Gia Dụng Thông Minh B&C',
      approvalStatus: 'APPROVED',
      payoutAccountRef: 'Techcombank-1903456789',
      createdAt: now,
      updatedAt: now,
    };
    this.supplierProfiles = [supplierAProf, supplierBProf];

    const sellerXProf: SellerProfile = {
      id: 'prof-sell-x',
      userId: sellerXUser.id,
      displayName: 'Nguyễn Văn Seller (TechStore Pro)',
      approvalStatus: 'APPROVED',
      createdAt: now,
      updatedAt: now,
    };
    this.sellerProfiles = [sellerXProf];

    // 4. Shops
    const shopX: Shop = {
      id: 'shop-x-1',
      sellerId: sellerXProf.id,
      name: 'TechStore Siêu Rẻ',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.shops = [shopX];

    // 5. Products (Product P1 by Supplier A, Product P2 by Supplier B)
    const productP1: Product = {
      id: 'prod-p1-anker',
      supplierId: supplierAProf.id,
      supplierSku: 'ANKER-30W-PD',
      name: 'Củ sạc nhanh Anker Nano III 30W Type-C GaN',
      description: 'Sạc nhanh siêu nhỏ gọn công nghệ GaN, tương thích iPhone 15/16, Samsung S24 và iPad.',
      costPrice: 180000, // 180.000 VND
      availableStock: 50,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      createdAt: now,
      updatedAt: now,
    };
    const productP2: Product = {
      id: 'prod-p2-locknlock',
      supplierId: supplierBProf.id,
      supplierSku: 'LNL-BOTTLE-500ML',
      name: 'Bình giữ nhiệt Lock&Lock Energetic One-Touch 500ml',
      description: 'Chất liệu thép không gỉ SUS316 cao cấp, giữ nóng 8 giờ, giữ lạnh 24 giờ, nắp mở 1 chạm.',
      costPrice: 220000, // 220.000 VND
      availableStock: 35,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
      createdAt: now,
      updatedAt: now,
    };
    const productP3: Product = {
      id: 'prod-p3-tainghe',
      supplierId: supplierAProf.id,
      supplierSku: 'BASEUS-ENC-W04',
      name: 'Tai nghe Bluetooth True Wireless Baseus Bowie E16',
      description: 'Âm bass mạnh mẽ, chống nước IPX4, thời lượng pin lên đến 30 giờ kèm dock sạc.',
      costPrice: 160000, // 160.000 VND
      availableStock: 40,
      status: 'ACTIVE',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
      createdAt: now,
      updatedAt: now,
    };
    this.products = [productP1, productP2, productP3];

    // 6. Listings (Published by Seller X in Shop X)
    // Rule: salePrice >= costPrice * (1 + 0.1)
    const listingL1: Listing = {
      id: 'list-l1-anker',
      productId: productP1.id,
      shopId: shopX.id,
      sellerSku: 'TS-ANKER-30W',
      salePrice: 279000, // 279.000 VND (cost 180.000 -> gross margin 99.000)
      status: 'ACTIVE',
      visible: true,
      createdAt: now,
      updatedAt: now,
    };
    const listingL2: Listing = {
      id: 'list-l2-locknlock',
      productId: productP2.id,
      shopId: shopX.id,
      sellerSku: 'TS-LOCK-500ML',
      salePrice: 349000, // 349.000 VND (cost 220.000 -> gross margin 129.000)
      status: 'ACTIVE',
      visible: true,
      createdAt: now,
      updatedAt: now,
    };
    const listingL3: Listing = {
      id: 'list-l3-baseus',
      productId: productP3.id,
      shopId: shopX.id,
      sellerSku: 'TS-BASEUS-E16',
      salePrice: 249000, // 249.000 VND (cost 160.000 -> gross margin 89.000)
      status: 'ACTIVE',
      visible: true,
      createdAt: now,
      updatedAt: now,
    };
    this.listings = [listingL1, listingL2, listingL3];

    // 7. Cart for Customer C
    const cartC: Cart = {
      id: 'cart-c-1',
      customerId: customerCUser.id,
      createdAt: now,
      updatedAt: now,
    };
    this.carts = [cartC];
    this.cartItems = [
      { id: this.generateUuid(), cartId: cartC.id, listingId: listingL1.id, quantity: 1, createdAt: now, updatedAt: now },
      { id: this.generateUuid(), cartId: cartC.id, listingId: listingL2.id, quantity: 1, createdAt: now, updatedAt: now },
    ];

    // 8. Sample completed/in-progress order for demo
    this.seedDemoOrder();

    this.logAudit('system', 'SYSTEM_INITIALIZED', 'SYSTEM', null, 'Seed demo dataset loaded with 2 Suppliers, 1 Seller, 1 Customer');
  }

  private seedDemoOrder() {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const orderId = 'ord-demo-001';
    const supplierA = this.supplierProfiles[0];
    const supplierB = this.supplierProfiles[1];
    const sellerX = this.sellerProfiles[0];
    const customer = this.users.find(u => u.email === 'customer@gmail.com')!;

    const order: CustomerOrder = {
      id: orderId,
      orderNo: 'DC-2026-98124',
      customerId: customer.id,
      status: 'PROCESSING',
      fulfillmentSummary: 'PARTIALLY_FULFILLED',
      currency: 'VND',
      grandTotal: 628000, // 279k + 349k
      totalPayable: 628000,
      shippingAddress: {
        recipientName: 'Trần Minh Customer',
        phone: '0912345678',
        address: 'Số 45, Đường Lê Duẩn, Phường Bến Nghé',
        city: 'Quận 1, TP. Hồ Chí Minh',
      },
      placedAt: pastDate,
      createdAt: pastDate,
      updatedAt: pastDate,
    };
    this.customerOrders.push(order);

    const orderItem1: OrderItem = {
      id: 'oi-demo-1',
      customerOrderId: orderId,
      listingId: this.listings[0].id,
      productNameSnapshot: this.products[0].name,
      quantity: 1,
      unitSalePriceSnapshot: 279000,
      unitCostPriceSnapshot: 180000,
      createdAt: pastDate,
    };
    const orderItem2: OrderItem = {
      id: 'oi-demo-2',
      customerOrderId: orderId,
      listingId: this.listings[1].id,
      productNameSnapshot: this.products[1].name,
      quantity: 1,
      unitSalePriceSnapshot: 349000,
      unitCostPriceSnapshot: 220000,
      createdAt: pastDate,
    };
    this.orderItems.push(orderItem1, orderItem2);

    // Fulfillment Order 1 (Supplier A) - DELIVERED
    const fo1: FulfillmentOrder = {
      id: 'fo-demo-a',
      fulfillmentNo: 'FO-2026-A01',
      customerOrderId: orderId,
      supplierId: supplierA.id,
      sellerId: sellerX.id,
      status: 'DELIVERED',
      trackingNo: 'GHN-884129481',
      carrierCode: 'GHN_EXPRESS',
      currency: 'VND',
      deliveryAttemptCount: 1,
      createdAt: pastDate,
      updatedAt: pastDate,
    };
    // Fulfillment Order 2 (Supplier B) - IN_TRANSIT
    const fo2: FulfillmentOrder = {
      id: 'fo-demo-b',
      fulfillmentNo: 'FO-2026-B01',
      customerOrderId: orderId,
      supplierId: supplierB.id,
      sellerId: sellerX.id,
      status: 'IN_TRANSIT',
      trackingNo: 'VTP-99238411',
      carrierCode: 'VIETTEL_POST',
      currency: 'VND',
      deliveryAttemptCount: 1,
      createdAt: pastDate,
      updatedAt: pastDate,
    };
    this.fulfillmentOrders.push(fo1, fo2);

    this.fulfillmentItems.push(
      { id: this.generateUuid(), fulfillmentOrderId: fo1.id, orderItemId: orderItem1.id, quantity: 1, itemGrossSnapshot: 279000 },
      { id: this.generateUuid(), fulfillmentOrderId: fo2.id, orderItemId: orderItem2.id, quantity: 1, itemGrossSnapshot: 349000 }
    );

    // Payment & Allocations
    const paymentId = 'pay-demo-001';
    this.payments.push({
      id: paymentId,
      customerOrderId: orderId,
      method: 'ONLINE_MOCK',
      status: 'PAID',
      amount: 628000,
      providerTransactionRef: 'VNPAY_TXN_987654321',
      createdAt: pastDate,
      updatedAt: pastDate,
    });
    this.paymentAllocations.push(
      {
        id: 'alloc-demo-a',
        paymentId,
        fulfillmentOrderId: fo1.id,
        merchandiseAmount: 279000,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: 279000,
        currency: 'VND',
        status: 'FUNDED',
        createdAt: pastDate,
      },
      {
        id: 'alloc-demo-b',
        paymentId,
        fulfillmentOrderId: fo2.id,
        merchandiseAmount: 349000,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: 349000,
        currency: 'VND',
        status: 'FUNDED',
        createdAt: pastDate,
      }
    );

    // Settlement for delivered FO 1
    const settlementFo1: Settlement = {
      id: 'stl-demo-1',
      fulfillmentOrderId: fo1.id,
      status: 'HOLD',
      supplierPayable: 180000,
      sellerEarning: 279000 - 180000 - Math.round(279000 * 0.05), // sale - cost - 5% fee
      platformFee: Math.round(279000 * 0.05),
      currency: 'VND',
      eligibleAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: pastDate,
      updatedAt: pastDate,
    };
    this.settlements.push(settlementFo1);
  }
}
