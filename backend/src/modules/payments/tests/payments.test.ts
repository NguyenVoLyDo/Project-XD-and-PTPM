import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../../../common/database/store.service';
import { PaymentsService } from '../application/payments.service';

describe('Payments Module - Unit & Contract Tests', () => {
  let store: StoreService;
  let service: PaymentsService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit(); // Nạp dữ liệu hạt giống (seed data)
    service = new PaymentsService(store);
  });

  describe('1. createCheckoutObligation (Khởi tạo thanh toán khi Checkout)', () => {
    it('Tạo nghĩa vụ thanh toán COD thành công với 2 đơn con của 2 Supplier', async () => {
      const orderId = store.generateUuid();
      const fo1 = store.generateUuid();
      const fo2 = store.generateUuid();

      const result = await service.createCheckoutObligation({
        orderId,
        method: 'COD',
        allocations: [
          {
            fulfillmentOrderId: fo1,
            merchandiseAmount: 150000,
            shippingAmount: 20000,
            discountAmount: 0,
            amountToCollect: 170000,
            currency: 'VND',
          },
          {
            fulfillmentOrderId: fo2,
            merchandiseAmount: 250000,
            shippingAmount: 0,
            discountAmount: 10000,
            amountToCollect: 240000,
            currency: 'VND',
          },
        ],
      });

      // Kiểm tra kết quả trả về
      expect(result.status).toBe('PENDING_COD');
      expect(result.allocationIds).toHaveLength(2);

      // Kiểm tra trong database/store
      const payment = store.payments.find((p) => p.id === result.paymentId);
      expect(payment).toBeDefined();
      expect(payment?.amount).toBe(410000); // 170k + 240k
      expect(payment?.method).toBe('COD');

      const allocations = store.paymentAllocations.filter((a) => a.paymentId === result.paymentId);
      expect(allocations).toHaveLength(2);
      expect(allocations[0].amountToCollect).toBe(170000);
      expect(allocations[1].amountToCollect).toBe(240000);
    });

    it('Tạo nghĩa vụ thanh toán ONLINE thành công (trạng thái PENDING)', async () => {
      const orderId = store.generateUuid();
      const fo = store.generateUuid();

      const result = await service.createCheckoutObligation({
        orderId,
        method: 'ONLINE',
        allocations: [
          {
            fulfillmentOrderId: fo,
            merchandiseAmount: 300000,
            shippingAmount: 0,
            discountAmount: 0,
            amountToCollect: 300000,
            currency: 'VND',
          },
        ],
      });

      expect(result.status).toBe('PENDING');
      expect(result.paymentIntentId).toMatch(/^pi_/);

      const payment = store.payments.find((p) => p.id === result.paymentId);
      expect(payment?.status).toBe('PENDING');
      expect(payment?.method).toBe('ONLINE_MOCK');
    });

    it('Ném lỗi BadRequest nếu số tiền cần thu không khớp công thức (amountToCollect != merch + ship - discount)', async () => {
      const orderId = store.generateUuid();
      const fo = store.generateUuid();

      await expect(
        service.createCheckoutObligation({
          orderId,
          method: 'COD',
          allocations: [
            {
              fulfillmentOrderId: fo,
              merchandiseAmount: 100000,
              shippingAmount: 20000,
              discountAmount: 10000,
              amountToCollect: 999999, // Sai lệch cố ý
              currency: 'VND',
            },
          ],
        }),
      ).rejects.toThrow('Số tiền phân bổ không khớp');
    });
  });

  describe('2. handleWebhook (Xử lý kết quả từ Cổng thanh toán)', () => {
    it('Cập nhật Payment sang PAID, Allocation sang FUNDED và Order sang CONFIRMED khi thành công', async () => {
      const orderId = store.generateUuid();
      const fo = store.generateUuid();

      // Giả lập đơn hàng trong store đang chờ thanh toán
      store.customerOrders.push({
        id: orderId,
        orderNo: 'ORD-TEST-001',
        customerId: 'cust-001',
        totalPayable: 200000,
        grandTotal: 200000,
        status: 'PENDING_PAYMENT',
        fulfillmentSummary: 'UNFULFILLED',
        currency: 'VND',
        placedAt: new Date().toISOString(),
        shippingAddress: { recipientName: 'Nguyen Van A', phone: '0901234567', address: 'HN', city: 'HN' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const obligation = await service.createCheckoutObligation({
        orderId,
        method: 'ONLINE',
        allocations: [
          {
            fulfillmentOrderId: fo,
            merchandiseAmount: 200000,
            shippingAmount: 0,
            discountAmount: 0,
            amountToCollect: 200000,
            currency: 'VND',
          },
        ],
      });

      // Cổng thanh toán gọi Webhook báo thành công
      const webhookRes = await service.handleWebhook({
        provider: 'VNPAY',
        providerEventId: 'evt_vnpay_123456',
        providerTransactionRef: 'TXN_999888',
        orderId,
        paymentId: obligation.paymentId,
        amount: 200000,
        status: 'SUCCESS',
        signature: 'valid_mock_signature',
        timestamp: new Date().toISOString(),
      });

      expect(webhookRes.success).toBe(true);
      expect(webhookRes.status).toBe('PAID');

      // Kiểm tra trạng thái đã được cập nhật
      const payment = store.payments.find((p) => p.id === obligation.paymentId);
      expect(payment?.status).toBe('PAID');
      expect(payment?.providerTransactionRef).toBe('TXN_999888');

      const alloc = store.paymentAllocations.find((a) => a.paymentId === obligation.paymentId);
      expect(alloc?.status).toBe('FUNDED');

      const order = store.customerOrders.find((o) => o.id === orderId);
      expect(order?.status).toBe('CONFIRMED');
    });

    it('Đảm bảo Idempotency: Webhook gọi lại lần 2 không lặp lại tác vụ và trả về duplicate=true', async () => {
      const orderId = store.generateUuid();
      const fo = store.generateUuid();

      const obligation = await service.createCheckoutObligation({
        orderId,
        method: 'ONLINE',
        allocations: [
          {
            fulfillmentOrderId: fo,
            merchandiseAmount: 100000,
            shippingAmount: 0,
            discountAmount: 0,
            amountToCollect: 100000,
            currency: 'VND',
          },
        ],
      });

      const webhookPayload = {
        provider: 'MOMO',
        providerEventId: 'evt_momo_unique_777',
        providerTransactionRef: 'MOMO_TXN_111',
        orderId,
        paymentId: obligation.paymentId,
        amount: 100000,
        status: 'SUCCESS' as const,
        signature: 'valid_signature',
        timestamp: new Date().toISOString(),
      };

      // Lần 1: Xử lý bình thường
      const firstCall = await service.handleWebhook(webhookPayload);
      expect(firstCall.duplicate).toBe(false);

      // Lần 2: Bắn lại cùng providerEventId
      const secondCall = await service.handleWebhook(webhookPayload);
      expect(secondCall.duplicate).toBe(true);
      expect(secondCall.message).toContain('Idempotent');
    });

    it('Từ chối Webhook nếu chữ ký không hợp lệ', async () => {
      await expect(
        service.handleWebhook({
          provider: 'VNPAY',
          providerEventId: 'evt_bad',
          providerTransactionRef: 'TXN_BAD',
          orderId: store.generateUuid(),
          paymentId: store.generateUuid(),
          amount: 50000,
          status: 'SUCCESS',
          signature: 'INVALID_SIGNATURE', // Giả lập chữ ký sai
          timestamp: new Date().toISOString(),
        }),
      ).rejects.toThrow('Chữ ký Webhook không hợp lệ');
    });
  });

  describe('3. refundAllocation & voidAllocation (Hoàn tiền và Hủy đơn con)', () => {
    it('Chỉ hoàn tiền đúng đơn con bị từ chối và chuyển Payment sang PARTIALLY_REFUNDED', async () => {
      const orderId = store.generateUuid();
      const fo1 = store.generateUuid();
      const fo2 = store.generateUuid();

      const obligation = await service.createCheckoutObligation({
        orderId,
        method: 'ONLINE',
        allocations: [
          {
            fulfillmentOrderId: fo1,
            merchandiseAmount: 100000,
            shippingAmount: 0,
            discountAmount: 0,
            amountToCollect: 100000,
            currency: 'VND',
          },
          {
            fulfillmentOrderId: fo2,
            merchandiseAmount: 200000,
            shippingAmount: 0,
            discountAmount: 0,
            amountToCollect: 200000,
            currency: 'VND',
          },
        ],
      });

      // Giả lập thanh toán thành công
      await service.handleWebhook({
        provider: 'VNPAY',
        providerEventId: 'evt_pay_all',
        providerTransactionRef: 'TXN_FULL',
        orderId,
        paymentId: obligation.paymentId,
        amount: 300000,
        status: 'SUCCESS',
        signature: 'valid',
        timestamp: new Date().toISOString(),
      });

      // Nhà cung cấp 1 từ chối đơn fo1 -> Hệ thống kích hoạt hoàn tiền đơn fo1
      const refundRes = await service.refundAllocation(fo1, 100000, 'SUPPLIER_REJECTED', 'DISPUTE_001');

      expect(refundRes.refundedAmount).toBe(100000);
      expect(refundRes.paymentStatus).toBe('PARTIALLY_REFUNDED');

      // Đơn fo2 vẫn giữ nguyên trạng thái FUNDED
      const alloc2 = store.paymentAllocations.find((a) => a.id === fo2);
      expect(alloc2?.status).toBe('FUNDED');
    });
  });
});

