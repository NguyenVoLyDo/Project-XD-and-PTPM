import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { StoreService } from '../../../common/database/store.service';
import {
  FulfillmentOrder,
  FulfillmentStatus,
} from '../../../common/database/types';
import { DemoCheckoutState } from '../../../integration/store-adapters.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { SettlementsService } from '../../settlements/application/settlements.service';

@Injectable()
export class FulfillmentService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
    @Optional()
    @Inject(DemoCheckoutState)
    private readonly demoState?: DemoCheckoutState,
    @Optional()
    @Inject(SettlementsService)
    private readonly settlementsService?: SettlementsService,
  ) {}

  /**
   * 1. LẤY DANH SÁCH ĐƠN HÀNG THUỘC VỀ NHÀ CUNG CẤP (SUPPLIER)
   */
  async getSupplierOrders(supplierProfileId: string) {
    if (!supplierProfileId) {
      throw new BadRequestException('Mã hồ sơ Nhà cung cấp không hợp lệ');
    }

    // Lọc các đơn con FulfillmentOrder có supplierId khớp với NCC đang đăng nhập
    const supplierFos = this.store.fulfillmentOrders.filter(
      (fo) => fo.supplierId === supplierProfileId,
    );

    return supplierFos
      .map((fo) => {
        // Tìm đơn tổng CustomerOrder
        const customerOrder = this.store.customerOrders.find(
          (co) => co.id === fo.customerOrderId,
        );

        // Lấy danh sách sản phẩm trong đơn con này
        const fItems = this.store.fulfillmentItems.filter(
          (fi) => fi.fulfillmentOrderId === fo.id,
        );
        const items = fItems.map((fi) => {
          const orderItem = this.store.orderItems.find((oi) => oi.id === fi.orderItemId);
          return {
            fulfillmentItemId: fi.id,
            orderItemId: fi.orderItemId,
            productName: orderItem?.productNameSnapshot || 'Sản phẩm',
            quantity: fi.quantity,
            unitSalePrice: orderItem?.unitSalePriceSnapshot || 0,
            itemGross: fi.itemGrossSnapshot || 0,
          };
        });

        // Tìm khoản phân bổ thanh toán
        const allocation = this.store.paymentAllocations.find(
          (pa) => pa.fulfillmentOrderId === fo.id,
        );

        return {
          fulfillmentOrderId: fo.id,
          fulfillmentNo: fo.fulfillmentNo,
          customerOrderId: fo.customerOrderId,
          orderNo: customerOrder?.orderNo || 'DC-2026',
          status: fo.status,
          carrierCode: fo.carrierCode,
          trackingNo: fo.trackingNo,
          amountToCollect: allocation?.amountToCollect || 0,
          paymentStatus: allocation?.status || 'PENDING',
          shippingAddress: customerOrder?.shippingAddress || null,
          items,
          createdAt: fo.createdAt,
          updatedAt: fo.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 2. NHÀ CUNG CẤP BẤM "TIẾP NHẬN ĐƠN HÀNG" (Accept Order)
   * - Đổi trạng thái sang ACCEPTED
   * - Chốt trừ kho thật (StockReservation -> COMMITTED)
   * - Cập nhật bước "NCC tiếp nhận & Đóng gói" trên màn hình khách hàng
   */
  async acceptOrder(supplierProfileId: string, fulfillmentOrderId: string) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng cần xử lý');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    const now = new Date().toISOString();
    fo.status = 'ACCEPTED';
    fo.updatedAt = now;

    // Chốt trừ tồn kho thật: StockReservation chuyển sang COMMITTED
    const fItems = this.store.fulfillmentItems.filter((fi) => fi.fulfillmentOrderId === fo.id);
    const itemIds = fItems.map((fi) => fi.orderItemId);
    const reservations = this.store.stockReservations.filter(
      (r) => itemIds.includes(r.orderItemId) && r.status === 'HELD',
    );
    for (const res of reservations) {
      res.status = 'COMMITTED';
    }

    // Cập nhật CustomerOrder sang PROCESSING
    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder) {
      customerOrder.status = 'PROCESSING';
      customerOrder.fulfillmentSummary = 'PARTIALLY_FULFILLED';
      customerOrder.updatedAt = now;
    }

    // Đồng bộ sang DemoCheckoutState nếu có
    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        (agg.order as any).status = 'PROCESSING';
        (agg.order as any).fulfillmentSummary = 'PARTIALLY_FULFILLED';
        (agg.order as any).updatedAt = now;
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'ACCEPTED';
      }
    }

    this.store.logAudit(
      supplierProfileId,
      'ACCEPT_FULFILLMENT_ORDER',
      'FULFILLMENT_ORDER',
      fo.id,
      `Supplier chấp nhận đơn hàng ${fo.fulfillmentNo}. Chốt tồn kho COMMITTED.`,
    );

    return { success: true, status: 'ACCEPTED', fulfillmentOrderId: fo.id };
  }

  /**
   * 3. NHÀ CUNG CẤP BẤM "GIAO CHO BƯU TÁ / ĐANG VẬN CHUYỂN" (Ship Order)
   * - Cập nhật mã vận đơn và đổi trạng thái sang SHIPPED
   * - Kích hoạt bước "Đang vận chuyển" trên màn hình khách hàng
   */
  async shipOrder(
    supplierProfileId: string,
    fulfillmentOrderId: string,
    carrierCode: string = 'GHN_EXPRESS',
    trackingNo: string = `GHN-${Date.now().toString().slice(-8)}`,
  ) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    const now = new Date().toISOString();
    fo.status = 'SHIPPED';
    fo.carrierCode = carrierCode;
    fo.trackingNo = trackingNo;
    fo.updatedAt = now;

    // Cập nhật CustomerOrder
    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder) {
      customerOrder.fulfillmentSummary = 'FULFILLED';
      customerOrder.updatedAt = now;
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        (agg.order as any).fulfillmentSummary = 'FULFILLED';
        (agg.order as any).updatedAt = now;
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) {
          (targetFo as any).status = 'SHIPPED';
          (targetFo as any).trackingNo = trackingNo;
          (targetFo as any).carrierCode = carrierCode;
        }
      }
    }

    this.store.logAudit(
      supplierProfileId,
      'SHIP_FULFILLMENT_ORDER',
      'FULFILLMENT_ORDER',
      fo.id,
      `Giao cho đơn vị vận chuyển ${carrierCode}. Mã vận đơn: ${trackingNo}`,
    );

    return { success: true, status: 'SHIPPED', trackingNo };
  }

  /**
   * 4. XÁC NHẬN GIAO HÀNG THÀNH CÔNG (Delivered)
   * - Kích hoạt bước "Giao hàng thành công" trên màn hình khách hàng
   */
  async deliverOrder(supplierProfileId: string, fulfillmentOrderId: string) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    const now = new Date().toISOString();
    fo.status = 'DELIVERED';
    fo.updatedAt = now;

    // Nếu là đơn COD đang chờ thu tiền (PENDING), shipper giao thành công -> chuyển sang COLLECTED
    const allocation = this.store.paymentAllocations.find((pa) => pa.fulfillmentOrderId === fo.id);
    if (allocation && allocation.status === 'PENDING') {
      const payment = this.store.payments.find((p) => p.id === allocation.paymentId);
      if (payment && payment.method === 'COD') {
        allocation.status = 'COLLECTED';
        const allAllocs = this.store.paymentAllocations.filter((a) => a.paymentId === payment.id);
        if (allAllocs.every((a) => a.status === 'COLLECTED' || a.status === 'VOIDED')) {
          payment.status = 'COLLECTED';
          payment.updatedAt = now;
        }
      }
    }

    // Tự động khởi tạo khoản đối soát HOLD (7 ngày đổi trả) và ghi sổ cái kế toán kép
    if (this.settlementsService) {
      await this.settlementsService.ensureSettlementOnDelivered(fo.id, now).catch(() => {});
    }

    // Kiểm tra nếu tất cả các đơn con đều đã DELIVERED -> đóng đơn tổng
    const allSiblingFos = this.store.fulfillmentOrders.filter(
      (f) => f.customerOrderId === fo.customerOrderId,
    );
    const allDelivered = allSiblingFos.every((f) => f.status === 'DELIVERED');

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder && allDelivered) {
      customerOrder.status = 'CLOSED';
      customerOrder.fulfillmentSummary = 'COMPLETED';
      customerOrder.updatedAt = now;
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        if (allDelivered) {
          (agg.order as any).status = 'CLOSED';
          (agg.order as any).fulfillmentSummary = 'COMPLETED';
        }
        (agg.order as any).updatedAt = now;
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'DELIVERED';
      }
    }

    this.store.logAudit(
      supplierProfileId,
      'DELIVER_FULFILLMENT_ORDER',
      'FULFILLMENT_ORDER',
      fo.id,
      `Kiện hàng ${fo.fulfillmentNo} đã giao thành công tới người mua.`,
    );

    return { success: true, status: 'DELIVERED' };
  }

  /**
   * 5. NHÀ CUNG CẤP TỪ CHỐI ĐƠN DO HẾT HÀNG (Reject Order)
   * - Nhả tồn kho (RELEASED)
   * - Kích hoạt hoàn tiền tự động cho khách
   */
  async rejectOrder(
    supplierProfileId: string,
    fulfillmentOrderId: string,
    reasonCode: string = 'OUT_OF_STOCK',
  ) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    const now = new Date().toISOString();
    fo.status = 'REJECTED';
    fo.updatedAt = now;

    // 1. Nhả reservation
    const fItems = this.store.fulfillmentItems.filter((fi) => fi.fulfillmentOrderId === fo.id);
    const itemIds = fItems.map((fi) => fi.orderItemId);
    const reservations = this.store.stockReservations.filter(
      (r) => itemIds.includes(r.orderItemId) && r.status === 'HELD',
    );
    for (const res of reservations) {
      res.status = 'RELEASED';
    }

    // 2. Kích hoạt hoàn tiền hoặc hủy nghĩa vụ COD qua PaymentsService
    const allocation = this.store.paymentAllocations.find((pa) => pa.fulfillmentOrderId === fo.id);
    if (allocation) {
      if (allocation.status === 'FUNDED') {
        await this.paymentsService.refundAllocation(
          allocation.id,
          allocation.amountToCollect,
          reasonCode,
          `REJECT_FO_${fo.id}`,
        );
      } else {
        await this.paymentsService.voidAllocation(
          allocation.id,
          reasonCode,
          `VOID_FO_${fo.id}`,
        );
      }
    }

    // 3. Cập nhật CustomerOrder
    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder) {
      customerOrder.fulfillmentSummary = 'PARTIALLY_CANCELED';
      customerOrder.updatedAt = now;
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        (agg.order as any).fulfillmentSummary = 'PARTIALLY_CANCELED';
        (agg.order as any).updatedAt = now;
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'REJECTED';
      }
    }

    this.store.logAudit(
      supplierProfileId,
      'REJECT_FULFILLMENT_ORDER',
      'FULFILLMENT_ORDER',
      fo.id,
      `Nhà cung cấp từ chối đơn hàng ${fo.fulfillmentNo}. Lý do: ${reasonCode}. Đã kích hoạt hoàn tiền/hủy kho.`,
    );

    return { success: true, status: 'REJECTED' };
  }
}
