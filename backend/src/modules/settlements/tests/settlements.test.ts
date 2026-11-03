import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../../../common/database/store.service';
import { SettlementsService } from '../application/settlements.service';

describe('Settlements Module - Unit & Contract Tests', () => {
  let store: StoreService;
  let service: SettlementsService;

  beforeEach(() => {
    store = new StoreService();
    store.onModuleInit();
    service = new SettlementsService(store);
    service.onModuleInit();
  });

  it('1. Khởi tạo đối soát khi DELIVERED: tính đúng vốn NCC, lãi Seller và cân bằng Tổng Nợ = Tổng Có', async () => {
    // Đưa fo-demo-b (Supplier B: giá bán 349k, giá vốn 220k) sang DELIVERED
    const foB = store.fulfillmentOrders.find((f) => f.id === 'fo-demo-b')!;
    foB.status = 'DELIVERED';
    const deliveredAt = '2026-11-01T00:00:00.000Z';
    foB.updatedAt = deliveredAt;

    const settlement = await service.ensureSettlementOnDelivered(foB.id, deliveredAt, 'src-deliv-b');

    expect(settlement.status).toBe('HOLD');
    expect(settlement.supplierPayable).toBe(220000);
    expect(settlement.sellerEarning).toBe(129000); // 349000 - 220000
    expect(settlement.platformFee).toBe(0);

    // Kiểm tra bất biến kế toán kép: Tổng DEBIT === Tổng CREDIT
    const legs = service.getDoubleEntryLedger(settlement.id);
    expect(legs.length).toBeGreaterThanOrEqual(3);
    const totalDebit = legs
      .filter((l) => l.direction === 'DEBIT')
      .reduce((s, l) => s + l.amountVnd, 0);
    const totalCredit = legs
      .filter((l) => l.direction === 'CREDIT')
      .reduce((s, l) => s + l.amountVnd, 0);

    expect(totalDebit).toBe(349000);
    expect(totalCredit).toBe(349000);
    expect(totalDebit).toBe(totalCredit);
  });

  it('2. Giữ tiền HOLD trong thời hạn 7 ngày đổi trả và mở ELIGIBLE sau khi hết hạn', async () => {
    const stl = store.settlements.find((s) => s.id === 'stl-demo-1')!;
    expect(stl.status).toBe('HOLD');

    // Trước khi hết hạn 7 ngày -> ném lỗi SETTLEMENT_NOT_ELIGIBLE
    await expect(
      service.evaluateEligibility(stl.id, new Date().toISOString(), 'eval-early'),
    ).rejects.toThrow();

    expect(stl.status).toBe('HOLD');

    // Sau khi qua thời hạn 7 ngày -> chuyển sang ELIGIBLE
    const after8Days = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const res = await service.evaluateEligibility(stl.id, after8Days, 'eval-after-7d');
    expect(res.status).toBe('ELIGIBLE');
    expect(stl.status).toBe('ELIGIBLE');
  });

  it('3. Giải ngân Mock Payout Idempotent: gọi lặp không tạo bút toán hay payout thứ hai', async () => {
    const stl = store.settlements.find((s) => s.id === 'stl-demo-1')!;
    const after8Days = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    await service.evaluateEligibility(stl.id, after8Days, 'eval-ok');

    const payout1 = await service.executePayout(stl.id, 'payout-ref-001');
    expect(payout1.status).toBe('PAID');
    expect(payout1.duplicate).toBe(false);

    const ledgerCountAfterFirst = service.getDoubleEntryLedger(stl.id).length;

    // Gọi lặp lần 2 cùng sourceRef
    const payout2 = await service.executePayout(stl.id, 'payout-ref-001');
    expect(payout2.status).toBe('PAID');
    expect(payout2.duplicate).toBe(true);
    expect(service.getDoubleEntryLedger(stl.id).length).toBe(ledgerCountAfterFirst);

    // Toàn bộ sổ cái sau Payout vẫn cân bằng Tổng DEBIT === Tổng CREDIT
    const allLegs = service.getDoubleEntryLedger(stl.id);
    const totalDebit = allLegs
      .filter((l) => l.direction === 'DEBIT')
      .reduce((s, l) => s + l.amountVnd, 0);
    const totalCredit = allLegs
      .filter((l) => l.direction === 'CREDIT')
      .reduce((s, l) => s + l.amountVnd, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('4. Phân quyền dữ liệu tài chính: Seller chỉ thấy lợi nhuận của mình, tuyệt đối không lộ giá vốn Supplier', async () => {
    const supplierAView = await service.getSupplierFinance('prof-supp-a');
    expect(supplierAView.settlements).toHaveLength(1);
    expect(supplierAView.settlements[0].supplierPayable).toBe(180000);

    // Supplier B chưa có đơn DELIVERED nên danh sách rỗng (không thấy tiền của Supplier A)
    const supplierBView = await service.getSupplierFinance('prof-supp-b');
    expect(supplierBView.settlements).toHaveLength(0);

    // Seller X xem doanh thu nhưng không được thấy trường supplierPayable (giá vốn NCC)
    const sellerXView = await service.getSellerFinance('prof-sell-x');
    expect(sellerXView.settlements).toHaveLength(1);
    expect(sellerXView.settlements[0].sellerEarning).toBeGreaterThan(0);
    expect('supplierPayable' in sellerXView.settlements[0]).toBe(false);
  });

  it('5. Đảo ngược bút toán Append-Only khi hoàn tiền: không sửa/xóa entry cũ, Tổng Nợ = Tổng Có', async () => {
    const stl = store.settlements.find((s) => s.id === 'stl-demo-1')!;
    const beforeLegs = service.getDoubleEntryLedger(stl.id);
    const beforeIds = beforeLegs.map((l) => l.id);

    const adj = await service.recordAdjustment(
      'alloc-demo-a',
      279000,
      'DAMAGED_ITEM',
      'refund-adj-001',
    );

    expect(adj.adjusted).toBe(true);
    expect(adj.status).toBe('REVERSED');

    const afterLegs = service.getDoubleEntryLedger(stl.id);
    // Append-only: các dòng bút toán cũ vẫn giữ nguyên 100%, có thêm group đảo mới
    expect(afterLegs.length).toBeGreaterThan(beforeLegs.length);
    for (const oldId of beforeIds) {
      expect(afterLegs.some((l) => l.id === oldId)).toBe(true);
    }

    const totalDebit = afterLegs
      .filter((l) => l.direction === 'DEBIT')
      .reduce((s, l) => s + l.amountVnd, 0);
    const totalCredit = afterLegs
      .filter((l) => l.direction === 'CREDIT')
      .reduce((s, l) => s + l.amountVnd, 0);
    expect(totalDebit).toBe(totalCredit);
  });
});

