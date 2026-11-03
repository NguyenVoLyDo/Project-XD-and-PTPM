import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { MockPaymentProviderAdapter } from '../infrastructure/mock-payment-provider.adapter';
import { PaymentReconciliationService } from '../application/payment-reconciliation.service';
import { WebhookLogService } from '../application/webhook-log.service';
import { StoreService } from '../../../common/database/store.service';
import { Payment, PaymentAllocation, Settlement, CustomerOrder } from '../../../common/database/types';

describe('Payment Provider Architecture & Reconciliation Tests', () => {
  let adapter: MockPaymentProviderAdapter;
  let reconciliation: PaymentReconciliationService;
  let webhookLog: WebhookLogService;
  let store: StoreService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit();
    adapter = new MockPaymentProviderAdapter();
    reconciliation = new PaymentReconciliationService(store);
    webhookLog = new WebhookLogService(store);
  });

  describe('MockPaymentProviderAdapter', () => {
    it('creates payment intent with valid checkout URL and QR data', async () => {
      const result = await adapter.createPaymentIntent({
        orderId: 'ord-123',
        amount: 500000,
        currency: 'VND',
        idempotencyKey: 'idemp-1',
        returnUrl: 'https://dropconnect.vn/orders/ord-123',
        notifyUrl: 'https://api.dropconnect.vn/api/v1/payments/webhooks/mock',
      });

      expect(result.providerPaymentId).toMatch(/^mock_pi_/);
      expect(result.checkoutUrl).toContain('ord-123');
      expect(result.qrCodeData).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('rejects payment intent with non-positive amount', async () => {
      await expect(
        adapter.createPaymentIntent({
          orderId: 'ord-123',
          amount: 0,
          currency: 'VND',
          idempotencyKey: 'idemp-2',
          returnUrl: 'https://dropconnect.vn/orders',
          notifyUrl: 'https://api.dropconnect.vn/api/v1/payments/webhooks/mock',
        }),
      ).rejects.toThrow('Số tiền thanh toán phải lớn hơn 0');
    });

    it('verifies valid HMAC-SHA256 signature correctly', () => {
      const payload = {
        orderId: 'ord-123',
        paymentId: 'pi_test_1',
        amount: 250000,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      };

      const signature = adapter.computeSignature(payload);
      const rawPayload = {
        headers: {
          'x-provider-signature': signature,
          'x-provider-timestamp': payload.timestamp,
        },
        body: payload,
      };

      const isValid = adapter.verifyWebhookSignature(rawPayload);
      expect(isValid).toBe(true);
    });

    it('rejects tampered webhook payload signature', () => {
      const payload = {
        orderId: 'ord-123',
        paymentId: 'pi_test_1',
        amount: 250000,
        status: 'SUCCESS',
      };

      const signature = adapter.computeSignature(payload);
      // Tamper amount
      const tamperedPayload = { ...payload, amount: 999999 };

      const raw = {
        headers: { 'x-provider-signature': signature },
        body: tamperedPayload,
      };

      const isValid = adapter.verifyWebhookSignature(raw);
      expect(isValid).toBe(false);
    });

    it('rejects webhook with expired timestamp (replay attack prevention)', () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      const payload = {
        orderId: 'ord-123',
        amount: 250000,
        timestamp: pastTime,
      };
      const signature = adapter.computeSignature(payload);

      const raw = {
        headers: {
          'x-provider-signature': signature,
          'x-provider-timestamp': pastTime,
        },
        body: payload,
      };

      const isValid = adapter.verifyWebhookSignature(raw);
      expect(isValid).toBe(false);
    });
  });

  describe('WebhookLogService (Idempotency & Replay Guard)', () => {
    it('records received webhook and prevents duplicate processing', () => {
      const event = {
        providerPaymentId: 'pi_test_1',
        orderId: 'ord-1',
        amount: 500000,
        currency: 'VND' as const,
        status: 'SUCCESS' as const,
        providerTransactionRef: 'tx_999',
        processedAt: new Date().toISOString(),
        eventId: 'event-uuid-1',
        rawPayload: { amount: 500000 },
      };

      expect(webhookLog.isDuplicate('MOCK', 'event-uuid-1')).toBe(false);
      webhookLog.recordEvent(event, 'MOCK');
      expect(webhookLog.isDuplicate('MOCK', 'event-uuid-1')).toBe(true);

      const logs = webhookLog.getRecentLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].eventId).toBe('event-uuid-1');
      expect(logs[0].signatureVerified).toBe(true);
    });
  });

  describe('PaymentReconciliationService', () => {
    it('reconciles consistent orders and verifies financial invariants', async () => {
      // Seed a matching payment and allocation in store
      const orderId = store.generateUuid();
      const paymentId = store.generateUuid();
      const foId = store.generateUuid();

      const customerOrder: CustomerOrder = {
        id: orderId,
        orderNo: 'DC-REC-001',
        customerId: 'u-customer-c',
        status: 'CONFIRMED',
        fulfillmentSummary: 'FULFILLED',
        currency: 'VND',
        grandTotal: 300000,
        totalPayable: 300000,
        shippingAddress: { recipientName: 'Test', phone: '0901', address: '123 St', city: 'HCM' },
        placedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.customerOrders.push(customerOrder);

      const payment: Payment = {
        id: paymentId,
        customerOrderId: orderId,
        method: 'ONLINE_MOCK',
        status: 'PAID',
        amount: 300000,
        providerTransactionRef: 'tx_rec_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.payments.push(payment);

      const allocation: PaymentAllocation = {
        id: foId,
        paymentId,
        fulfillmentOrderId: foId,
        merchandiseAmount: 300000,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: 300000,
        currency: 'VND',
        status: 'FUNDED',
        createdAt: new Date().toISOString(),
      };
      store.paymentAllocations.push(allocation);

      const settlement: Settlement = {
        id: store.generateUuid(),
        fulfillmentOrderId: foId,
        status: 'CALCULATED',
        supplierPayable: 200000,
        sellerEarning: 70000,
        platformFee: 30000, // 200k + 70k + 30k = 300k (merchandiseAmount)
        currency: 'VND',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.settlements.push(settlement);

      const report = await reconciliation.runReconciliation();
      expect(report.totalPaymentsAudited).toBeGreaterThanOrEqual(1);
      expect(report.discrepancyCount).toBe(0);
      expect(report.financialSummary.invariantsPreserved).toBe(true);
    });

    it('detects allocation sum mismatch as a discrepancy', async () => {
      const orderId = store.generateUuid();
      const paymentId = store.generateUuid();

      store.customerOrders.push({
        id: orderId,
        orderNo: 'DC-DISC-001',
        customerId: 'u-customer-c',
        status: 'CONFIRMED',
        fulfillmentSummary: 'UNFULFILLED',
        currency: 'VND',
        grandTotal: 500000,
        totalPayable: 500000,
        shippingAddress: { recipientName: 'Test', phone: '0901', address: '123', city: 'HCM' },
        placedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      store.payments.push({
        id: paymentId,
        customerOrderId: orderId,
        method: 'ONLINE_MOCK',
        status: 'PAID',
        amount: 500000,
        providerTransactionRef: 'tx_disc_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Allocation only totals 400,000 (100,000 missing)
      store.paymentAllocations.push({
        id: store.generateUuid(),
        paymentId,
        fulfillmentOrderId: store.generateUuid(),
        merchandiseAmount: 400000,
        shippingAmount: 0,
        discountAmount: 0,
        amountToCollect: 400000,
        currency: 'VND',
        status: 'FUNDED',
        createdAt: new Date().toISOString(),
      });

      const report = await reconciliation.runReconciliation();
      const mismatch = report.discrepancies.find((d) => d.paymentId === paymentId);
      expect(mismatch).toBeDefined();
      expect(mismatch?.issue).toBe('ALLOCATION_SUM_MISMATCH');
    });
  });
});

