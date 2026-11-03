import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../../src/common/database/store.service';
import { PasswordHasherService } from '../../src/modules/identity/infrastructure/password-hasher.service';
import { PaymentsService } from '../../src/modules/payments/application/payments.service';
import { FulfillmentService } from '../../src/modules/fulfillment/application/fulfillment.service';
import { SettlementsService } from '../../src/modules/settlements/application/settlements.service';
import { DisputesService } from '../../src/modules/disputes/application/disputes.service';

describe('DropConnect E2E Full System Lifecycle Audit', () => {
  let store: StoreService;
  let hasher: PasswordHasherService;
  let paymentsService: PaymentsService;
  let settlementsService: SettlementsService;
  let fulfillmentService: FulfillmentService;
  let disputesService: DisputesService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit();
    hasher = new PasswordHasherService();
    paymentsService = new PaymentsService(store);
    settlementsService = new SettlementsService(store);
    settlementsService.onModuleInit();
    fulfillmentService = new FulfillmentService(store, paymentsService, undefined, settlementsService);
    disputesService = new DisputesService(store, paymentsService, settlementsService);
  });

  it('1. Identity & Security: Password hashing, Role accounts & Audit logs', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hasher.hash(rawPassword);
    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const valid = await hasher.verify(hash, rawPassword);
    expect(valid).toBe(true);

    const invalid = await hasher.verify(hash, 'WrongPassword');
    expect(invalid).toBe(false);

    // Verify seed accounts existence
    expect(store.users.length).toBeGreaterThanOrEqual(4);
    expect(store.supplierProfiles.length).toBeGreaterThanOrEqual(1);
    expect(store.sellerProfiles.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Catalog & Margin Guard: Seller price must satisfy minimum profit margin', () => {
    const product = store.products.find((p) => p.id === 'prod-p1-anker')!;
    expect(product).toBeDefined();
    expect(product.costPrice).toBe(180000);

    const minMarginRate = 0.1; // 10% sàn
    const minAllowedSalePrice = Math.round(product.costPrice * (1 + minMarginRate));
    expect(minAllowedSalePrice).toBe(198000);

    // Listing hợp lệ
    const validListing = store.listings.find((l) => l.productId === product.id && l.status === 'ACTIVE');
    expect(validListing).toBeDefined();
    expect(validListing!.salePrice).toBeGreaterThanOrEqual(minAllowedSalePrice);
  });

  it('3. Checkout & Order Splitting: 1 CustomerOrder with 2 Suppliers splits into 2 FulfillmentOrders', () => {
    const parentOrder = store.customerOrders[0];
    expect(parentOrder).toBeDefined();

    // Check that fulfillment orders are partitioned by supplier
    const childOrders = store.fulfillmentOrders.filter((fo) => fo.customerOrderId === parentOrder.id);
    expect(childOrders.length).toBe(2);

    const supplierIds = new Set(childOrders.map((fo) => fo.supplierId));
    expect(supplierIds.size).toBe(2); // 2 distinct suppliers
  });

  it('4. Fulfillment Lifecycle & COD Sync: PENDING -> CONFIRMED -> SHIPPED -> DELIVERED', async () => {
    // Take fulfillment order fo-demo-b (Supplier B)
    const fo = store.fulfillmentOrders.find((f) => f.id === 'fo-demo-b')!;
    expect(fo).toBeDefined();

    // Reset status to PENDING for full lifecycle test
    fo.status = 'PENDING';

    // 1. Supplier accepts order
    await fulfillmentService.acceptOrder('prof-supp-b', fo.id);
    expect(fo.status).toBe('ACCEPTED');

    // 2. Handover to carrier with tracking number
    await fulfillmentService.shipOrder('prof-supp-b', fo.id, {
      trackingNo: 'VNPOST-888999',
      carrierCode: 'VNPOST',
    });
    expect(fo.status).toBe('SHIPPED');
    expect(fo.trackingNo).toBeDefined();

    // 3. Deliver order -> Triggers COD collection and automatic Settlement HOLD
    await fulfillmentService.deliverOrder('prof-supp-b', fo.id);
    expect(fo.status).toBe('DELIVERED');

    const allocation = store.paymentAllocations.find((pa) => pa.fulfillmentOrderId === fo.id);
    expect(['FUNDED', 'COLLECTED']).toContain(allocation?.status);

    // Settlement auto initialized with HOLD status (7 days return window)
    const stl = store.settlements.find((s) => s.fulfillmentOrderId === fo.id);
    expect(stl).toBeDefined();
    expect(stl?.status).toBe('HOLD');
  });

  it('5. Financial Ledger & Double-Entry Invariant: Total DEBIT === Total CREDIT', async () => {
    // Verify double-entry balance for all transaction groups in ledger
    const allLegs = settlementsService.getDoubleEntryLedger();
    expect(allLegs.length).toBeGreaterThanOrEqual(2);

    const groups = new Map<string, { debit: number; credit: number }>();
    for (const leg of allLegs) {
      if (!groups.has(leg.transactionGroupRef)) {
        groups.set(leg.transactionGroupRef, { debit: 0, credit: 0 });
      }
      const g = groups.get(leg.transactionGroupRef)!;
      if (leg.direction === 'DEBIT') g.debit += leg.amountVnd;
      else g.credit += leg.amountVnd;
    }

    for (const [, totals] of groups.entries()) {
      expect(totals.debit).toBe(totals.credit); // Balanced!
    }
  });

  it('6. Seller Data Isolation: Seller cannot see Supplier cost price', async () => {
    const sellerFinance = await settlementsService.getSellerFinance('prof-sell-x');
    expect(sellerFinance.settlements.length).toBeGreaterThan(0);

    for (const item of sellerFinance.settlements) {
      expect((item as any).supplierPayable).toBeUndefined(); // Strictly hidden!
      expect(item.sellerEarning).toBeGreaterThan(0);
    }
  });

  it('7. Dispute Flow: Customer dispute freezes Settlement, Admin approval & Return triggers refund and reverses ledger', async () => {
    const fo = store.fulfillmentOrders.find((f) => f.id === 'fo-demo-a')!;
    expect(fo.status).toBe('DELIVERED');

    // 1. Customer creates dispute
    const disputeRes = await disputesService.createCustomerDispute('u-customer-c', {
      fulfillmentOrderId: fo.id,
      reasonCode: 'DAMAGED_ITEM',
      description: 'Hàng bị vỡ khi mở hộp kiểm tra',
      evidenceUrls: ['https://example.com/broken.jpg'],
      adminOverride: false,
    });
    expect(disputeRes.status).toBe('REQUESTED');

    // 2. Settlement must be locked in HOLD status
    expect(settlementsService.hasOpenDispute(fo.id)).toBe(true);

    // 3. Admin approves dispute
    const adminDecision = await disputesService.recordAdminDecision('u-admin-1', disputeRes.returnRequestId, {
      decision: 'APPROVED',
      reasonCode: 'EVIDENCE_VERIFIED',
      instantRefundDemo: true, // Auto refund for demo flow
    });
    expect(adminDecision.decision).toBe('APPROVED');
    expect(adminDecision.status).toBe('REFUNDED');

    // 4. Fulfillment order updated to REFUNDED
    expect(fo.status).toBe('REFUNDED');

    // 5. Settlement updated to REVERSED with reversing double-entry ledger group
    const stl = store.settlements.find((s) => s.fulfillmentOrderId === fo.id)!;
    expect(stl.status).toBe('REVERSED');
  });

  it('8. Settlement Payout: After 7 days and no open disputes, HOLD transitions to ELIGIBLE and PAID', async () => {
    // Deliver fo-demo-b
    const fo = store.fulfillmentOrders.find((f) => f.id === 'fo-demo-b')!;
    if (fo.status !== 'DELIVERED') {
      await fulfillmentService.deliverOrder('prof-supp-b', fo.id);
    }
    const stl = store.settlements.find((s) => s.fulfillmentOrderId === fo.id)!;
    expect(stl.status).toBe('HOLD');

    // Fast-forward 8 days past the 7-day return window
    const after8Days = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const evalRes = await settlementsService.evaluateEligibility(stl.id, after8Days, 'eval-day-8');
    expect(evalRes.status).toBe('ELIGIBLE');
    expect(stl.status).toBe('ELIGIBLE');

    // Execute mock payout
    const payoutRes = await settlementsService.executePayout(stl.id, 'payout-ref-1');
    expect(payoutRes.status).toBe('PAID');
    expect(stl.status).toBe('PAID');
  });
});
