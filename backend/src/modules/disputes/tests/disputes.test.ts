import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../../../common/database/store.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { SettlementsService } from '../../settlements/application/settlements.service';
import { DisputesService } from '../application/disputes.service';

describe('Disputes Module - Unit & Contract Tests', () => {
  let store: StoreService;
  let paymentsService: PaymentsService;
  let settlementsService: SettlementsService;
  let disputesService: DisputesService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit();
    paymentsService = new PaymentsService(store);
    settlementsService = new SettlementsService(store);
    settlementsService.onModuleInit();
    disputesService = new DisputesService(store, paymentsService, settlementsService);
  });

  it('1. Mở khiếu nại trong 7 ngày thành công và giữ chặt đối soát Settlement ở trạng thái HOLD', async () => {
    const res = await disputesService.createCustomerDispute('u-customer-c', {
      fulfillmentOrderId: 'fo-demo-a',
      orderItemId: 'oi-demo-1',
      reasonCode: 'DAMAGED_ITEM',
      description: 'Sản phẩm bị trầy xước vỏ ngoài khi nhận hàng',
      evidenceUrls: ['https://example.com/evidence1.jpg'],
      adminOverride: false,
    });

    expect(res.status).toBe('REQUESTED');
    expect(res.fulfillmentOrderId).toBe('fo-demo-a');
    expect(settlementsService.hasOpenDispute('fo-demo-a')).toBe(true);

    // Dù đã qua 10 ngày, Settlement vẫn bị chặn không cho sang ELIGIBLE khi Dispute đang mở!
    const after10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    await expect(
      settlementsService.evaluateEligibility('stl-demo-1', after10Days, 'eval-blocked'),
    ).rejects.toThrow();

    const stl = store.settlements.find((s) => s.id === 'stl-demo-1')!;
    expect(stl.status).toBe('HOLD');
  });

  it('2. Từ chối tạo khiếu nại nếu quá hạn 7 ngày kể từ khi DELIVERED (RETURN_WINDOW_EXPIRED)', async () => {
    const after15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    await expect(
      disputesService.createCustomerDispute('u-customer-c', {
        fulfillmentOrderId: 'fo-demo-a',
        reasonCode: 'DAMAGED_ITEM',
        description: 'Quá hạn 7 ngày mới khiếu nại',
        evidenceUrls: [],
        now: after15Days,
        adminOverride: false,
      }),
    ).rejects.toThrow();
  });

  it('3. Chặn khách không sở hữu đơn (403) và không cho mở lại case đã CLOSED cùng reasonCode', async () => {
    // Khách lạ không sở hữu đơn
    await expect(
      disputesService.createCustomerDispute('u-seller-x', {
        fulfillmentOrderId: 'fo-demo-a',
        reasonCode: 'WRONG_ITEM',
        description: 'Thử mở khiếu nại đơn người khác',
        evidenceUrls: [],
        adminOverride: false,
      }),
    ).rejects.toThrow();

    // Chủ đơn mở khiếu nại -> Admin bác bỏ (CLOSED) -> Chủ đơn cố mở lại cùng reasonCode WRONG_ITEM
    const created = await disputesService.createCustomerDispute('u-customer-c', {
      fulfillmentOrderId: 'fo-demo-a',
      reasonCode: 'WRONG_ITEM',
      description: 'Giao sai màu sắc',
      evidenceUrls: [],
      adminOverride: false,
    });

    const rejected = await disputesService.recordAdminDecision(
      'u-admin-1',
      created.returnRequestId,
      {
        decision: 'REJECTED',
        reasonCode: 'INVALID_EVIDENCE',
        instantRefundDemo: false,
      },
    );
    expect(rejected.status).toBe('CLOSED');
    expect(store.refunds).toHaveLength(0);

    // Sau khi khiếu nại bị bác bỏ & đóng, Settlement được mở khóa sau 7 ngày!
    const after10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const evalAfterReject = await settlementsService.evaluateEligibility(
      'stl-demo-1',
      after10Days,
      'eval-unblocked',
    );
    expect(evalAfterReject.status).toBe('ELIGIBLE');

    // Cố mở lại case mới với cùng reasonCode WRONG_ITEM -> bị từ chối theo hợp đồng
    await expect(
      disputesService.createCustomerDispute('u-customer-c', {
        fulfillmentOrderId: 'fo-demo-a',
        reasonCode: 'WRONG_ITEM',
        description: 'Mở lại cùng lý do cũ',
        evidenceUrls: [],
        adminOverride: false,
      }),
    ).rejects.toThrow();
  });

  it('4. Chu trình duyệt -> gửi trả hàng -> nhận hàng hoàn -> hoàn tiền đúng 1 đơn con & Idempotent', async () => {
    // Đơn tổng ord-demo-001 gồm 2 đơn con: fo-demo-a (279k - Supplier A) và fo-demo-b (349k - Supplier B)
    const created = await disputesService.createCustomerDispute('u-customer-c', {
      fulfillmentOrderId: 'fo-demo-a',
      orderItemId: 'oi-demo-1',
      reasonCode: 'DEFECTIVE',
      description: 'Củ sạc không vào điện',
      evidenceUrls: [],
      adminOverride: false,
    });

    // Bước 1: Admin duyệt APPROVED
    const approved = await disputesService.recordAdminDecision(
      'u-admin-1',
      created.returnRequestId,
      {
        decision: 'APPROVED',
        reasonCode: 'VALID_DEFECT',
        instantRefundDemo: false,
        sourceRef: 'dec-approve-001',
      },
    );
    expect(approved.status).toBe('APPROVED');

    // Bước 2: Khách gửi hàng trả lại bưu cục
    const shipped = await disputesService.shipReturnItem(
      'u-customer-c',
      created.returnRequestId,
      'RET-VNPOST-001',
    );
    expect(shipped.status).toBe('RETURN_IN_TRANSIT');

    // Bước 3: Supplier B cố xác nhận hàng hoàn của Supplier A -> bị chặn Forbidden!
    await expect(
      disputesService.confirmReturnReceived(
        'u-supplier-b',
        'SUPPLIER',
        'prof-supp-b',
        created.returnRequestId,
      ),
    ).rejects.toThrow();

    // Bước 4: Supplier A xác nhận đã nhận hàng hoàn về kho -> Kích hoạt Refund & Đảo sổ cái
    const received1 = await disputesService.confirmReturnReceived(
      'u-supplier-a',
      'SUPPLIER',
      'prof-supp-a',
      created.returnRequestId,
      'recv-ref-001',
    );
    expect(received1.status).toBe('REFUNDED');
    expect(received1.refundedAmount).toBe(279000);

    // Kiểm tra cô lập dòng tiền: Chỉ hoàn tiền alloc-demo-a, KHÔNG đụng tới alloc-demo-b của Supplier B!
    const allocA = store.paymentAllocations.find((a) => a.id === 'alloc-demo-a')!;
    const allocB = store.paymentAllocations.find((a) => a.id === 'alloc-demo-b')!;
    const parentPayment = store.payments.find((p) => p.id === 'pay-demo-001')!;

    expect(allocA.status).toBe('REFUNDED');
    expect(allocB.status).toBe('FUNDED');
    expect(parentPayment.status).toBe('PARTIALLY_REFUNDED');
    expect(store.refunds).toHaveLength(1);

    // Settlement của fo-demo-a chuyển sang REVERSED và sổ cái cân bằng Nợ = Có
    const stlA = store.settlements.find((s) => s.id === 'stl-demo-1')!;
    expect(stlA.status).toBe('REVERSED');

    const legs = settlementsService.getDoubleEntryLedger(stlA.id);
    const debitSum = legs.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + l.amountVnd, 0);
    const creditSum = legs.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + l.amountVnd, 0);
    expect(debitSum).toBe(creditSum);

    // Bước 5: Gọi lặp confirmReturnReceived lần 2 -> Idempotent, không tạo Refund thứ hai!
    const received2 = await disputesService.confirmReturnReceived(
      'u-supplier-a',
      'SUPPLIER',
      'prof-supp-a',
      created.returnRequestId,
      'recv-ref-001',
    );
    expect(received2.duplicate).toBe(true);
    expect(store.refunds).toHaveLength(1);
    expect(settlementsService.getDoubleEntryLedger(stlA.id).length).toBe(legs.length);
  });
});

