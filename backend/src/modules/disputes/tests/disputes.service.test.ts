import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import { DisputesService } from '../disputes.service';
import { StoreService } from '../../../common/database/store.service';
import { ReturnRequest, PaymentAllocation, FulfillmentOrder } from '../../../common/database/types';

describe('DisputesService Unit Tests', () => {
  let service: DisputesService;
  let store: StoreService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit();
    service = new DisputesService(store);
  });

  it('lists existing return requests', async () => {
    const list = await service.listReturnRequests();
    expect(Array.isArray(list)).toBe(true);
  });

  it('approves a valid return request and triggers refund when paid', async () => {
    const returnRequestId = store.generateUuid();
    const fulfillmentOrderId = store.generateUuid();
    const orderItemId = store.generateUuid();
    const paymentId = store.generateUuid();

    // Seed ReturnRequest
    const rr: ReturnRequest = {
      id: returnRequestId,
      fulfillmentOrderId,
      orderItemId,
      customerId: 'u-customer-c',
      reasonCode: 'DAMAGED_ITEM',
      reasonDescription: 'Sản phẩm bị vỡ hộp khi nhận',
      evidenceUrls: ['https://example.com/evidence1.jpg'],
      status: 'UNDER_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.returnRequests.push(rr);

    // Seed FulfillmentOrder & PaymentAllocation
    store.fulfillmentOrders.push({
      id: fulfillmentOrderId,
      fulfillmentNo: 'FO-DISP-01',
      customerOrderId: 'co-1',
      supplierId: 'supp-1',
      sellerId: 'sell-1',
      status: 'DELIVERED',
      trackingNo: 'TRK-01',
      carrierCode: 'GHN',
      currency: 'VND',
      deliveryAttemptCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.paymentAllocations.push({
      id: store.generateUuid(),
      paymentId,
      fulfillmentOrderId,
      merchandiseAmount: 180000,
      shippingAmount: 0,
      discountAmount: 0,
      amountToCollect: 180000,
      currency: 'VND',
      status: 'FUNDED',
      createdAt: new Date().toISOString(),
    });

    const result = await service.decideDispute(returnRequestId, {
      decision: 'APPROVED',
      reasonCode: 'EVIDENCE_CONFIRMED',
      adminId: 'u-admin-1',
    });

    expect(result.decision).toBe('APPROVED');
    expect(result.status).toBe('APPROVED');
    expect(result.refundTriggered).toBe(true);
    expect(result.refundId).toBeDefined();

    // Check store state
    const updatedRr = store.returnRequests.find((r) => r.id === returnRequestId);
    expect(updatedRr?.status).toBe('APPROVED');
    expect(updatedRr?.adminDecision).toContain('APPROVED');

    // Check refund created
    const refund = store.refunds.find((r) => r.id === result.refundId);
    expect(refund).toBeDefined();
    expect(refund?.status).toBe('PENDING');

    // Check notification sent to customer
    const notif = store.notifications.find((n) => n.recipientUserId === 'u-customer-c');
    expect(notif).toBeDefined();
    expect(notif?.type).toBe('SUCCESS');
  });

  it('rejects a return request and updates status without refund', async () => {
    const returnRequestId = store.generateUuid();
    store.returnRequests.push({
      id: returnRequestId,
      fulfillmentOrderId: store.generateUuid(),
      orderItemId: store.generateUuid(),
      customerId: 'u-customer-c',
      reasonCode: 'USER_MISTAKE',
      reasonDescription: 'Đổi ý không muốn mua nữa',
      evidenceUrls: [],
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.decideDispute(returnRequestId, {
      decision: 'REJECTED',
      reasonCode: 'RETURN_POLICY_EXPIRED',
      adminId: 'u-admin-1',
    });

    expect(result.decision).toBe('REJECTED');
    expect(result.status).toBe('REJECTED');
    expect(result.refundTriggered).toBe(false);

    const notif = store.notifications.find((n) => n.recipientUserId === 'u-customer-c');
    expect(notif?.type).toBe('WARNING');
  });

  it('rejects decision on already finalized return request', async () => {
    const returnRequestId = store.generateUuid();
    store.returnRequests.push({
      id: returnRequestId,
      fulfillmentOrderId: store.generateUuid(),
      orderItemId: store.generateUuid(),
      customerId: 'u-customer-c',
      reasonCode: 'DEFECTIVE',
      reasonDescription: 'Hỏng',
      evidenceUrls: [],
      status: 'CLOSED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      service.decideDispute(returnRequestId, {
        decision: 'APPROVED',
        adminId: 'u-admin-1',
      }),
    ).rejects.toThrow('không thể ra quyết định');
  });
});

