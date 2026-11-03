import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { StoreService } from '../../../common/database/store.service';
import {
  Settlement,
  FinancialEntry,
  ReturnRequestStatus,
} from '../../../common/database/types';
import {
  DoubleEntryLeg,
  LedgerAccountCode,
  LedgerDirection,
} from '../api/contracts';

const RETURN_WINDOW_DAYS = 7;

const OPEN_DISPUTE_STATUSES: ReturnRequestStatus[] = [
  'REQUESTED',
  'EVIDENCE_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'RETURN_IN_TRANSIT',
  'RECEIVED',
];

@Injectable()
export class SettlementsService implements OnModuleInit {
  /**
   * Sổ cái kế toán kép (Double-Entry Append-Only Ledger).
   * Bất biến: Trong mỗi transactionGroupRef, Tổng DEBIT === Tổng CREDIT.
   */
  private readonly doubleEntryLedger: DoubleEntryLeg[] = [];

  /**
   * Tập hợp khóa Idempotency chống chạy lặp nghiệp vụ tài chính
   */
  private readonly processedSourceRefs = new Map<string, any>();

  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  onModuleInit() {
    this.syncSeededSettlementsLedger();
  }

  /**
   * Bổ sung bút toán kế toán kép ban đầu cho dữ liệu mẫu (stl-demo-1) trong StoreService
   */
  private syncSeededSettlementsLedger() {
    for (const stl of this.store.settlements) {
      const hasGroup = this.doubleEntryLedger.some((leg) => leg.settlementId === stl.id);
      if (!hasGroup) {
        const totalGross = stl.supplierPayable + stl.sellerEarning + stl.platformFee;
        if (totalGross > 0) {
          const legs: Array<{
            accountCode: LedgerAccountCode;
            direction: LedgerDirection;
            amountVnd: number;
            description: string;
          }> = [
            {
              accountCode: 'ESCROW_CASH',
              direction: 'DEBIT',
              amountVnd: totalGross,
              description: 'Ghi nhận tiền hàng khách thanh toán vào quỹ đối soát tạm giữ',
            },
          ];

          if (stl.supplierPayable > 0) {
            legs.push({
              accountCode: 'SUPPLIER_PAYABLE',
              direction: 'CREDIT',
              amountVnd: stl.supplierPayable,
              description: 'Phải trả tiền vốn gốc cho Nhà cung cấp',
            });
          }
          if (stl.sellerEarning > 0) {
            legs.push({
              accountCode: 'SELLER_PAYABLE',
              direction: 'CREDIT',
              amountVnd: stl.sellerEarning,
              description: 'Phải trả lợi nhuận bán hàng cho Seller',
            });
          }
          if (stl.platformFee > 0) {
            legs.push({
              accountCode: 'PLATFORM_REVENUE',
              direction: 'CREDIT',
              amountVnd: stl.platformFee,
              description: 'Doanh thu phí hoa hồng nền tảng',
            });
          }

          this.appendBalancedTransactionGroup(
            stl.id,
            stl.fulfillmentOrderId,
            `STL_INIT_${stl.id}`,
            `seed:${stl.id}`,
            legs,
            stl.createdAt,
          );
        }
      }
    }
  }

  /**
   * Ghi nhận 1 nhóm bút toán kế toán kép (Append-only)
   * Bắt buộc kiểm tra bất biến: Tổng Nợ (DEBIT) === Tổng Có (CREDIT)
   */
  private appendBalancedTransactionGroup(
    settlementId: string,
    fulfillmentOrderId: string,
    transactionGroupRef: string,
    businessSourceRef: string,
    rawLegs: Array<{
      accountCode: LedgerAccountCode;
      direction: LedgerDirection;
      amountVnd: number;
      description: string;
    }>,
    postedAt: string = new Date().toISOString(),
  ): DoubleEntryLeg[] {
    const validLegs = rawLegs.filter((l) => l.amountVnd > 0);
    if (validLegs.length < 2) {
      throw new BadRequestException('Bút toán kế toán kép phải có ít nhất 2 vế Nợ/Có');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const leg of validLegs) {
      if (!Number.isInteger(leg.amountVnd) || leg.amountVnd <= 0) {
        throw new BadRequestException('Số tiền bút toán VND phải là số nguyên dương');
      }
      if (leg.direction === 'DEBIT') totalDebit += leg.amountVnd;
      else totalCredit += leg.amountVnd;
    }

    if (totalDebit !== totalCredit) {
      throw new ConflictException(
        `Vi phạm bất biến kế toán kép cho group ${transactionGroupRef}: Tổng DEBIT (${totalDebit}) !== Tổng CREDIT (${totalCredit})`,
      );
    }

    const createdLegs: DoubleEntryLeg[] = [];
    validLegs.forEach((leg, index) => {
      const legSourceRef = `${businessSourceRef}:${index}`;
      // Chống ghi trùng sourceRef
      if (this.doubleEntryLedger.some((existing) => existing.sourceRef === legSourceRef)) {
        return;
      }

      const entry: DoubleEntryLeg = {
        id: this.store.generateUuid(),
        settlementId,
        fulfillmentOrderId,
        transactionGroupRef,
        accountCode: leg.accountCode,
        direction: leg.direction,
        amountVnd: leg.amountVnd,
        currency: 'VND',
        sourceRef: legSourceRef,
        description: leg.description,
        postedAt,
      };
      this.doubleEntryLedger.push(entry);
      createdLegs.push(entry);

      // Đồng bộ bản ghi tóm tắt sang StoreService.financialEntries (chuẩn types.ts)
      let storeEntryType: FinancialEntry['type'] | null = null;
      if (leg.accountCode === 'SUPPLIER_PAYABLE' && leg.direction === 'CREDIT') {
        storeEntryType = 'SUPPLIER_PAYABLE';
      } else if (leg.accountCode === 'SELLER_PAYABLE' && leg.direction === 'CREDIT') {
        storeEntryType = 'SELLER_EARNING';
      } else if (leg.accountCode === 'PLATFORM_REVENUE' && leg.direction === 'CREDIT') {
        storeEntryType = 'PLATFORM_FEE';
      } else if (leg.accountCode === 'CUSTOMER_REFUND' && leg.direction === 'CREDIT') {
        storeEntryType = 'REFUND_DEDUCTION';
      }

      if (storeEntryType) {
        this.store.financialEntries.push({
          id: entry.id,
          settlementId,
          type: storeEntryType,
          amount: leg.amountVnd,
          currency: 'VND',
          sourceRef: legSourceRef,
          postedAt,
        });
      }
    });

    return createdLegs;
  }

  /**
   * Kiểm tra xem đơn con có đang bị vướng Khiếu nại / Trả hàng (Dispute) đang mở hay không
   */
  hasOpenDispute(fulfillmentOrderId: string): boolean {
    return this.store.returnRequests.some(
      (rr) =>
        rr.fulfillmentOrderId === fulfillmentOrderId &&
        OPEN_DISPUTE_STATUSES.includes(rr.status),
    );
  }

  /**
   * 1. KHỞI TẠO ĐỐI SOÁT KHI ĐƠN CON GIAO THÀNH CÔNG (DELIVERED)
   * - Gắn với 1 FulfillmentOrder duy nhất
   * - Đặt trạng thái HOLD trong 7 ngày đổi trả (returnWindowDays = 7)
   * - Ghi sổ cái kế toán kép ban đầu (Idempotent)
   */
  async ensureSettlementOnDelivered(
    fulfillmentOrderId: string,
    deliveredAtIso: string = new Date().toISOString(),
    sourceRef?: string,
  ): Promise<Settlement> {
    const existing = this.store.settlements.find(
      (s) => s.fulfillmentOrderId === fulfillmentOrderId,
    );
    if (existing) {
      this.syncSeededSettlementsLedger();
      return existing;
    }

    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) {
      throw new NotFoundException(`Không tìm thấy đơn vận chuyển: ${fulfillmentOrderId}`);
    }

    if (fo.status !== 'DELIVERED') {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: 'Chỉ khởi tạo đối soát cho đơn hàng đã giao thành công (DELIVERED)',
      });
    }

    const allocation = this.store.paymentAllocations.find(
      (pa) => pa.fulfillmentOrderId === fulfillmentOrderId,
    );
    if (!allocation || (allocation.status !== 'FUNDED' && allocation.status !== 'COLLECTED')) {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: 'Khoản thanh toán của đơn con chưa được thu tiền (FUNDED/COLLECTED)',
      });
    }

    // Tính toán công thức theo docs/contracts/settlements.md:
    // supplierPayable = sum(unitCostPriceSnapshot * quantity)
    // sellerEarning = lineSaleTotal - supplierPayable - platformFee
    const fItems = this.store.fulfillmentItems.filter(
      (fi) => fi.fulfillmentOrderId === fulfillmentOrderId,
    );

    let lineSaleTotal = 0;
    let supplierPayable = 0;

    for (const fi of fItems) {
      const oi = this.store.orderItems.find((item) => item.id === fi.orderItemId);
      if (oi) {
        lineSaleTotal += oi.unitSalePriceSnapshot * fi.quantity;
        supplierPayable += oi.unitCostPriceSnapshot * fi.quantity;
      } else {
        lineSaleTotal += fi.itemGrossSnapshot;
      }
    }

    if (lineSaleTotal === 0) {
      lineSaleTotal = allocation.merchandiseAmount;
    }

    const platformFee = 0; // MVP mặc định platformFee = 0 theo contract settlements.md
    const sellerEarning = Math.max(0, lineSaleTotal - supplierPayable - platformFee);

    const deliveredMs = Date.parse(deliveredAtIso);
    const eligibleAt = new Date(
      deliveredMs + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const settlementId = this.store.generateUuid();
    const settlement: Settlement = {
      id: settlementId,
      fulfillmentOrderId,
      status: 'HOLD',
      supplierPayable,
      sellerEarning,
      platformFee,
      currency: 'VND',
      eligibleAt,
      createdAt: deliveredAtIso,
      updatedAt: deliveredAtIso,
    };

    this.store.settlements.push(settlement);

    const businessRef = sourceRef || `DELIVERED_${fulfillmentOrderId}`;
    const legs: Array<{
      accountCode: LedgerAccountCode;
      direction: LedgerDirection;
      amountVnd: number;
      description: string;
    }> = [
      {
        accountCode: 'ESCROW_CASH',
        direction: 'DEBIT',
        amountVnd: supplierPayable + sellerEarning + platformFee,
        description: `Tạm giữ tiền thanh toán đơn ${fo.fulfillmentNo} trong ${RETURN_WINDOW_DAYS} ngày đổi trả`,
      },
    ];

    if (supplierPayable > 0) {
      legs.push({
        accountCode: 'SUPPLIER_PAYABLE',
        direction: 'CREDIT',
        amountVnd: supplierPayable,
        description: `Ghi nhận công nợ tiền vốn gốc trả NCC cho đơn ${fo.fulfillmentNo}`,
      });
    }
    if (sellerEarning > 0) {
      legs.push({
        accountCode: 'SELLER_PAYABLE',
        direction: 'CREDIT',
        amountVnd: sellerEarning,
        description: `Ghi nhận hoa hồng lợi nhuận trả Seller cho đơn ${fo.fulfillmentNo}`,
      });
    }
    if (platformFee > 0) {
      legs.push({
        accountCode: 'PLATFORM_REVENUE',
        direction: 'CREDIT',
        amountVnd: platformFee,
        description: `Phí hoa hồng nền tảng cho đơn ${fo.fulfillmentNo}`,
      });
    }

    if (supplierPayable + sellerEarning + platformFee > 0) {
      this.appendBalancedTransactionGroup(
        settlement.id,
        fulfillmentOrderId,
        `STL_HOLD_${fulfillmentOrderId}`,
        businessRef,
        legs,
        deliveredAtIso,
      );
    }

    this.store.logAudit(
      'system',
      'CREATE_SETTLEMENT_HOLD',
      'SETTLEMENT',
      settlement.id,
      `Tạo khoản đối soát HOLD cho đơn ${fo.fulfillmentNo}. Vốn NCC: ${supplierPayable}đ, Lãi Seller: ${sellerEarning}đ. Mở khóa lúc: ${eligibleAt}`,
    );

    return settlement;
  }

  /**
   * 2. ĐÁNH GIÁ ĐIỀU KIỆN ĐỐI SOÁT (Settlement.evaluateEligibility)
   * - Idempotent theo sourceRef
   * - Chỉ chuyển HOLD -> ELIGIBLE khi:
   *   1) Đơn đã DELIVERED
   *   2) Tiền đã FUNDED hoặc COLLECTED
   *   3) Không có Dispute (khiếu nại) đang mở
   *   4) Đã qua 7 ngày đổi trả (now >= eligibleAt)
   */
  async evaluateEligibility(
    settlementOrFoId: string,
    nowIso?: string,
    sourceRef?: string,
    fastForwardDemo: boolean = false,
  ) {
    if (sourceRef && this.processedSourceRefs.has(`eval:${sourceRef}`)) {
      return { ...this.processedSourceRefs.get(`eval:${sourceRef}`), duplicate: true };
    }

    let settlement = this.store.settlements.find(
      (s) => s.id === settlementOrFoId || s.fulfillmentOrderId === settlementOrFoId,
    );

    if (!settlement) {
      // Thử khởi tạo nếu đơn đã DELIVERED
      const fo = this.store.fulfillmentOrders.find((f) => f.id === settlementOrFoId);
      if (!fo) {
        throw new NotFoundException('Không tìm thấy khoản đối soát hoặc kiện hàng tương ứng');
      }
      settlement = await this.ensureSettlementOnDelivered(fo.id);
    }

    const fo = this.store.fulfillmentOrders.find((f) => f.id === settlement!.fulfillmentOrderId);
    if (!fo || fo.status !== 'DELIVERED') {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: 'Khoản đối soát chưa đủ điều kiện: Kiện hàng chưa ở trạng thái DELIVERED',
      });
    }

    const allocation = this.store.paymentAllocations.find(
      (pa) => pa.fulfillmentOrderId === fo.id,
    );
    if (!allocation || (allocation.status !== 'FUNDED' && allocation.status !== 'COLLECTED')) {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: 'Khoản đối soát chưa đủ điều kiện: Tiền hàng chưa thu thành công',
      });
    }

    if (settlement.status === 'REVERSED') {
      throw new ConflictException({
        code: 'SETTLEMENT_REVERSED',
        message: 'Khoản đối soát này đã bị đảo ngược bút toán do hoàn tiền',
      });
    }

    // Ràng buộc quan trọng: Đang có Dispute mở -> bắt buộc giữ nguyên HOLD!
    if (this.hasOpenDispute(fo.id)) {
      throw new ConflictException({
        code: 'SETTLEMENT_HELD_BY_DISPUTE',
        message: 'Khoản đối soát đang tạm đóng băng (HOLD) do đơn hàng có khiếu nại / yêu cầu trả hàng chưa đóng',
      });
    }

    if (settlement.status === 'ELIGIBLE' || settlement.status === 'CALCULATED' || settlement.status === 'PAID') {
      const res = {
        settlementId: settlement.id,
        fulfillmentOrderId: settlement.fulfillmentOrderId,
        status: settlement.status,
        supplierPayable: settlement.supplierPayable,
        sellerEarning: settlement.sellerEarning,
        platformFee: settlement.platformFee,
        duplicate: false,
      };
      if (sourceRef) this.processedSourceRefs.set(`eval:${sourceRef}`, res);
      return res;
    }

    const eligibleTime = settlement.eligibleAt ? Date.parse(settlement.eligibleAt) : 0;
    const evaluationTime = fastForwardDemo
      ? Math.max(Date.now(), eligibleTime + 60_000)
      : nowIso
        ? Date.parse(nowIso)
        : Date.now();

    if (evaluationTime < eligibleTime) {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: `Khoản đối soát chưa đủ điều kiện: Chưa hết thời hạn ${RETURN_WINDOW_DAYS} ngày đổi trả (Mở khóa sau ${new Date(eligibleTime).toLocaleDateString('vi-VN')})`,
      });
    }

    settlement.status = 'ELIGIBLE';
    settlement.updatedAt = new Date().toISOString();
    if (fastForwardDemo) {
      settlement.eligibleAt = new Date().toISOString();
    }

    this.store.logAudit(
      'system',
      'SETTLEMENT_ELIGIBLE',
      'SETTLEMENT',
      settlement.id,
      `Khoản đối soát đơn ${fo.fulfillmentNo} đủ điều kiện chi trả (ELIGIBLE).${fastForwardDemo ? ' [Mô phỏng qua 7 ngày đổi trả]' : ''}`,
    );

    const response = {
      settlementId: settlement.id,
      fulfillmentOrderId: settlement.fulfillmentOrderId,
      status: settlement.status,
      supplierPayable: settlement.supplierPayable,
      sellerEarning: settlement.sellerEarning,
      platformFee: settlement.platformFee,
      duplicate: false,
    };

    if (sourceRef) {
      this.processedSourceRefs.set(`eval:${sourceRef}`, response);
    }

    return response;
  }

  /**
   * 3. GIẢI NGÂN MÔ PHỎNG (Mock Payout: ELIGIBLE -> CALCULATED -> PAYOUT_PENDING -> PAID)
   * - Idempotent theo sourceRef
   * - Ghi bút toán kế toán kép tất toán công nợ (DEBIT Payables === CREDIT BANK_OUTFLOW)
   */
  async executePayout(
    settlementId: string,
    sourceRef?: string,
    simulateFailure: boolean = false,
    actorId: string | null = null,
  ) {
    const effectiveRef = sourceRef || `payout_${settlementId}`;
    if (this.processedSourceRefs.has(`payout:${effectiveRef}`)) {
      return { ...this.processedSourceRefs.get(`payout:${effectiveRef}`), duplicate: true };
    }

    const settlement = this.store.settlements.find(
      (s) => s.id === settlementId || s.fulfillmentOrderId === settlementId,
    );
    if (!settlement) {
      throw new NotFoundException(`Không tìm thấy khoản đối soát: ${settlementId}`);
    }

    if (this.hasOpenDispute(settlement.fulfillmentOrderId)) {
      throw new ConflictException({
        code: 'SETTLEMENT_HELD_BY_DISPUTE',
        message: 'Không thể giải ngân khi đơn hàng đang có khiếu nại mở',
      });
    }

    if (settlement.status === 'PAID') {
      return {
        settlementId: settlement.id,
        status: 'PAID',
        duplicate: true,
      };
    }

    if (settlement.status === 'HOLD' || settlement.status === 'REVERSED') {
      throw new ConflictException({
        code: 'SETTLEMENT_NOT_ELIGIBLE',
        message: `Khoản đối soát đang ở trạng thái ${settlement.status}, chưa đủ điều kiện giải ngân`,
      });
    }

    const now = new Date().toISOString();
    settlement.status = 'PAYOUT_PENDING';
    settlement.updatedAt = now;

    if (simulateFailure) {
      this.store.logAudit(
        actorId,
        'SETTLEMENT_PAYOUT_FAILED',
        'SETTLEMENT',
        settlement.id,
        `Mô phỏng lỗi kết nối cổng chi trả ngân hàng. Có thể retry an toàn với mã mới.`,
      );
      return {
        settlementId: settlement.id,
        status: settlement.status,
        payoutOutcome: 'PAYOUT_FAILED',
        retryable: true,
      };
    }

    // Ghi bút toán kế toán kép giải ngân: Giảm Phải trả (DEBIT) / Ghi nhận Tiền ra ngân hàng (CREDIT)
    const totalOutflow =
      settlement.supplierPayable + settlement.sellerEarning + settlement.platformFee;

    if (totalOutflow > 0) {
      const payoutLegs: Array<{
        accountCode: LedgerAccountCode;
        direction: LedgerDirection;
        amountVnd: number;
        description: string;
      }> = [];

      if (settlement.supplierPayable > 0) {
        payoutLegs.push({
          accountCode: 'SUPPLIER_PAYABLE',
          direction: 'DEBIT',
          amountVnd: settlement.supplierPayable,
          description: 'Tất toán công nợ chuyển khoản cho Nhà cung cấp',
        });
      }
      if (settlement.sellerEarning > 0) {
        payoutLegs.push({
          accountCode: 'SELLER_PAYABLE',
          direction: 'DEBIT',
          amountVnd: settlement.sellerEarning,
          description: 'Tất toán hoa hồng lợi nhuận chuyển khoản cho Seller',
        });
      }
      if (settlement.platformFee > 0) {
        payoutLegs.push({
          accountCode: 'PLATFORM_REVENUE',
          direction: 'DEBIT',
          amountVnd: settlement.platformFee,
          description: 'Kết chuyển phí nền tảng về quỹ sàn',
        });
      }
      payoutLegs.push({
        accountCode: 'BANK_OUTFLOW',
        direction: 'CREDIT',
        amountVnd: totalOutflow,
        description: `Chi tiền giải ngân đối soát (Ref: ${effectiveRef})`,
      });

      this.appendBalancedTransactionGroup(
        settlement.id,
        settlement.fulfillmentOrderId,
        `STL_PAYOUT_${settlement.id}`,
        `payout:${effectiveRef}`,
        payoutLegs,
        now,
      );
    }

    settlement.status = 'PAID';
    settlement.updatedAt = now;

    this.store.logAudit(
      actorId,
      'SETTLEMENT_PAID',
      'SETTLEMENT',
      settlement.id,
      `Đã giải ngân thành công khoản đối soát ${settlement.id}. NCC nhận ${settlement.supplierPayable}đ, Seller nhận ${settlement.sellerEarning}đ.`,
    );

    const response = {
      settlementId: settlement.id,
      fulfillmentOrderId: settlement.fulfillmentOrderId,
      status: settlement.status,
      supplierPayable: settlement.supplierPayable,
      sellerEarning: settlement.sellerEarning,
      payoutRef: `PO_${Date.now().toString().slice(-8)}`,
      duplicate: false,
    };

    this.processedSourceRefs.set(`payout:${effectiveRef}`, response);
    return response;
  }

  /**
   * 4. GHI NHẬN ĐẢO BÚT TOÁN / ĐIỀU CHỈNH KHI HOÀN TIỀN KHIẾU NẠI (Settlement.recordAdjustment)
   * - Append-only: Tạo group bút toán đảo mới (Tổng DEBIT === Tổng CREDIT), tuyệt đối không sửa/xóa entry cũ!
   * - Idempotent theo sourceRef
   */
  async recordAdjustment(
    allocationId: string,
    amount: number,
    reasonCode: string,
    sourceRef: string,
  ) {
    if (sourceRef && this.processedSourceRefs.has(`adj:${sourceRef}`)) {
      return { ...this.processedSourceRefs.get(`adj:${sourceRef}`), duplicate: true };
    }

    const allocation = this.store.paymentAllocations.find(
      (a) => a.id === allocationId || a.fulfillmentOrderId === allocationId,
    );
    if (!allocation) {
      throw new NotFoundException(`Không tìm thấy phân bổ thanh toán: ${allocationId}`);
    }

    const settlement = this.store.settlements.find(
      (s) => s.fulfillmentOrderId === allocation.fulfillmentOrderId,
    );

    // Nếu đơn con chưa từng lên đối soát (ví dụ hủy trước khi giao hàng) thì không cần đảo đối soát
    if (!settlement) {
      const noOpResult = {
        adjusted: false,
        reason: 'NO_SETTLEMENT_CREATED_YET',
        duplicate: false,
      };
      if (sourceRef) this.processedSourceRefs.set(`adj:${sourceRef}`, noOpResult);
      return noOpResult;
    }

    const totalCurrent =
      settlement.supplierPayable + settlement.sellerEarning + settlement.platformFee;
    const refundRatio = totalCurrent > 0 ? Math.min(1, amount / totalCurrent) : 1;

    let supplierReversal = Math.round(settlement.supplierPayable * refundRatio);
    let platformReversal = Math.round(settlement.platformFee * refundRatio);
    let sellerReversal = amount - supplierReversal - platformReversal;

    // Đảm bảo không âm do làm tròn số nguyên
    if (sellerReversal < 0) {
      supplierReversal = Math.max(0, amount - platformReversal);
      sellerReversal = amount - supplierReversal - platformReversal;
    }

    const now = new Date().toISOString();
    const reversalLegs: Array<{
      accountCode: LedgerAccountCode;
      direction: LedgerDirection;
      amountVnd: number;
      description: string;
    }> = [];

    if (supplierReversal > 0) {
      reversalLegs.push({
        accountCode: 'SUPPLIER_PAYABLE',
        direction: 'DEBIT',
        amountVnd: supplierReversal,
        description: `Đảo giảm công nợ NCC do hoàn tiền khiếu nại (${reasonCode})`,
      });
    }
    if (sellerReversal > 0) {
      reversalLegs.push({
        accountCode: 'SELLER_PAYABLE',
        direction: 'DEBIT',
        amountVnd: sellerReversal,
        description: `Đảo giảm lợi nhuận Seller do hoàn tiền khiếu nại (${reasonCode})`,
      });
    }
    if (platformReversal > 0) {
      reversalLegs.push({
        accountCode: 'PLATFORM_REVENUE',
        direction: 'DEBIT',
        amountVnd: platformReversal,
        description: `Đảo giảm phí sàn do hoàn tiền khiếu nại (${reasonCode})`,
      });
    }

    reversalLegs.push({
      accountCode: 'CUSTOMER_REFUND',
      direction: 'CREDIT',
      amountVnd: amount,
      description: `Hoàn trả tiền cho Khách hàng (${reasonCode})`,
    });

    this.appendBalancedTransactionGroup(
      settlement.id,
      settlement.fulfillmentOrderId,
      `STL_REV_${sourceRef}`,
      `adj:${sourceRef}`,
      reversalLegs,
      now,
    );

    if (amount >= totalCurrent) {
      settlement.status = 'REVERSED';
      settlement.supplierPayable = 0;
      settlement.sellerEarning = 0;
      settlement.platformFee = 0;
    } else {
      settlement.supplierPayable = Math.max(0, settlement.supplierPayable - supplierReversal);
      settlement.sellerEarning = Math.max(0, settlement.sellerEarning - sellerReversal);
      settlement.platformFee = Math.max(0, settlement.platformFee - platformReversal);
    }
    settlement.updatedAt = now;

    this.store.logAudit(
      'system',
      'SETTLEMENT_ADJUSTED_REVERSED',
      'SETTLEMENT',
      settlement.id,
      `Đảo bút toán đối soát ${amount}đ do hoàn tiền (${reasonCode}). Trạng thái mới: ${settlement.status}`,
    );

    const result = {
      adjusted: true,
      settlementId: settlement.id,
      status: settlement.status,
      reversedAmount: amount,
      remainingSupplierPayable: settlement.supplierPayable,
      remainingSellerEarning: settlement.sellerEarning,
      duplicate: false,
    };

    if (sourceRef) {
      this.processedSourceRefs.set(`adj:${sourceRef}`, result);
    }

    return result;
  }

  /**
   * Tự động quét các đơn DELIVERED chưa có bản ghi đối soát để đồng bộ
   */
  private ensureDeliveredOrdersSynced() {
    this.syncSeededSettlementsLedger();
    const deliveredFos = this.store.fulfillmentOrders.filter((fo) => fo.status === 'DELIVERED');
    for (const fo of deliveredFos) {
      const allocation = this.store.paymentAllocations.find(
        (pa) => pa.fulfillmentOrderId === fo.id,
      );
      if (allocation && (allocation.status === 'FUNDED' || allocation.status === 'COLLECTED')) {
        const hasStl = this.store.settlements.some((s) => s.fulfillmentOrderId === fo.id);
        if (!hasStl) {
          this.ensureSettlementOnDelivered(fo.id, fo.updatedAt || fo.createdAt).catch(() => {});
        }
      }
    }
  }

  /**
   * 5. BÁO CÁO TÀI CHÍNH & VÍ ĐỐI SOÁT CHO NHÀ CUNG CẤP (GET /api/v1/supplier/finance)
   * - Chỉ lọc đúng các đơn thuộc supplierProfileId
   */
  async getSupplierFinance(supplierProfileId: string) {
    if (!supplierProfileId) {
      throw new ForbiddenException('Không xác định được hồ sơ Nhà cung cấp');
    }

    this.ensureDeliveredOrdersSynced();

    const supplierProfile = this.store.supplierProfiles.find((p) => p.id === supplierProfileId);
    const supplierFos = this.store.fulfillmentOrders.filter(
      (fo) => fo.supplierId === supplierProfileId,
    );
    const foIdSet = new Set(supplierFos.map((fo) => fo.id));

    const items = this.store.settlements
      .filter((s) => foIdSet.has(s.fulfillmentOrderId))
      .map((s) => {
        const fo = supplierFos.find((f) => f.id === s.fulfillmentOrderId)!;
        const order = this.store.customerOrders.find((o) => o.id === fo.customerOrderId);
        return {
          settlementId: s.id,
          fulfillmentOrderId: s.fulfillmentOrderId,
          fulfillmentNo: fo.fulfillmentNo,
          orderNo: order?.orderNo || 'DC-2026',
          status: s.status,
          supplierPayable: s.supplierPayable,
          currency: s.currency,
          eligibleAt: s.eligibleAt,
          hasOpenDispute: this.hasOpenDispute(s.fulfillmentOrderId),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      holdingAmount: items
        .filter((i) => i.status === 'HOLD')
        .reduce((sum, i) => sum + i.supplierPayable, 0),
      eligibleAmount: items
        .filter((i) => i.status === 'ELIGIBLE' || i.status === 'CALCULATED' || i.status === 'PAYOUT_PENDING')
        .reduce((sum, i) => sum + i.supplierPayable, 0),
      paidAmount: items
        .filter((i) => i.status === 'PAID')
        .reduce((sum, i) => sum + i.supplierPayable, 0),
      reversedCount: items.filter((i) => i.status === 'REVERSED').length,
      payoutAccountRef: supplierProfile?.payoutAccountRef || 'Chưa liên kết ngân hàng',
      legalName: supplierProfile?.legalName || 'Nhà cung cấp',
    };

    const ledgerEntries = this.doubleEntryLedger
      .filter(
        (leg) =>
          foIdSet.has(leg.fulfillmentOrderId) &&
          (leg.accountCode === 'SUPPLIER_PAYABLE' ||
            leg.accountCode === 'ESCROW_CASH' ||
            leg.accountCode === 'BANK_OUTFLOW' ||
            leg.accountCode === 'CUSTOMER_REFUND'),
      )
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    return {
      role: 'SUPPLIER',
      supplierProfileId,
      summary,
      settlements: items,
      ledgerEntries,
    };
  }

  /**
   * 6. BÁO CÁO TÀI CHÍNH & HOA HỒNG CHO SELLER (GET /api/v1/seller/finance)
   * - Chỉ lọc đúng các đơn thuộc sellerProfileId
   * - BẢO MẬT HỢP ĐỒNG: Tuyệt đối KHÔNG trả về supplierPayable (giá vốn NCC)!
   */
  async getSellerFinance(sellerProfileId: string) {
    if (!sellerProfileId) {
      throw new ForbiddenException('Không xác định được hồ sơ Người bán (Seller)');
    }

    this.ensureDeliveredOrdersSynced();

    const sellerProfile = this.store.sellerProfiles.find((p) => p.id === sellerProfileId);
    const shop = this.store.shops.find((s) => s.sellerId === sellerProfileId);
    const sellerFos = this.store.fulfillmentOrders.filter(
      (fo) => fo.sellerId === sellerProfileId,
    );
    const foIdSet = new Set(sellerFos.map((fo) => fo.id));

    const items = this.store.settlements
      .filter((s) => foIdSet.has(s.fulfillmentOrderId))
      .map((s) => {
        const fo = sellerFos.find((f) => f.id === s.fulfillmentOrderId)!;
        const order = this.store.customerOrders.find((o) => o.id === fo.customerOrderId);
        const allocation = this.store.paymentAllocations.find(
          (pa) => pa.fulfillmentOrderId === fo.id,
        );
        // Lưu ý: KHÔNG trả trường supplierPayable cho Seller theo docs/contracts/settlements.md!
        return {
          settlementId: s.id,
          fulfillmentOrderId: s.fulfillmentOrderId,
          fulfillmentNo: fo.fulfillmentNo,
          orderNo: order?.orderNo || 'DC-2026',
          status: s.status,
          grossSaleAmount: allocation?.merchandiseAmount || 0,
          sellerEarning: s.sellerEarning,
          platformFee: s.platformFee,
          currency: s.currency,
          eligibleAt: s.eligibleAt,
          hasOpenDispute: this.hasOpenDispute(s.fulfillmentOrderId),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      holdingAmount: items
        .filter((i) => i.status === 'HOLD')
        .reduce((sum, i) => sum + i.sellerEarning, 0),
      eligibleAmount: items
        .filter((i) => i.status === 'ELIGIBLE' || i.status === 'CALCULATED' || i.status === 'PAYOUT_PENDING')
        .reduce((sum, i) => sum + i.sellerEarning, 0),
      paidAmount: items
        .filter((i) => i.status === 'PAID')
        .reduce((sum, i) => sum + i.sellerEarning, 0),
      reversedCount: items.filter((i) => i.status === 'REVERSED').length,
      displayName: sellerProfile?.displayName || 'Người bán',
      shopName: shop?.name || 'Gian hàng',
    };

    // Chỉ hiển thị các dòng bút toán liên quan đến SELLER_PAYABLE (ẩn SUPPLIER_PAYABLE)
    const ledgerEntries = this.doubleEntryLedger
      .filter(
        (leg) =>
          foIdSet.has(leg.fulfillmentOrderId) &&
          leg.accountCode === 'SELLER_PAYABLE',
      )
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    return {
      role: 'SELLER',
      sellerProfileId,
      summary,
      settlements: items,
      ledgerEntries,
    };
  }

  /**
   * Trả về toàn bộ các dòng bút toán kế toán kép của 1 khoản đối soát (dùng cho Admin & Unit Tests kiểm chứng Tổng Nợ === Tổng Có)
   */
  getDoubleEntryLedger(settlementId?: string): DoubleEntryLeg[] {
    if (!settlementId) return [...this.doubleEntryLedger];
    return this.doubleEntryLedger.filter((leg) => leg.settlementId === settlementId);
  }
}

