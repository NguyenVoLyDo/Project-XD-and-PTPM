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
  CustomerOrderStatus,
} from '../../../common/database/types';
import { DemoCheckoutState } from '../../../integration/store-adapters.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { SettlementsService } from '../../settlements/application/settlements.service';
import { computeFulfillmentSummary } from '../../orders/domain/fulfillment-projection';
import { CommerceDb } from '../../../integration/postgres/commerce-db';

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
    @Optional()
    @Inject(CommerceDb)
    private readonly db?: CommerceDb,
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
   * LẤY DANH SÁCH ĐƠN HÀNG THUỘC VỀ NGƯỜI BÁN (SELLER)
   * Tuân thủ NFR-06: Ẩn số điện thoại, địa chỉ chi tiết và giá vốn khi trả cho Seller
   */
  async getSellerOrders(sellerProfileId: string) {
    if (!sellerProfileId) {
      throw new BadRequestException('Mã hồ sơ Người bán không hợp lệ');
    }

    const sellerFos = this.store.fulfillmentOrders.filter(
      (fo) => fo.sellerId === sellerProfileId,
    );

    return sellerFos
      .map((fo) => {
        const customerOrder = this.store.customerOrders.find(
          (co) => co.id === fo.customerOrderId,
        );
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

        const allocation = this.store.paymentAllocations.find(
          (pa) => pa.fulfillmentOrderId === fo.id,
        );

        // NFR-06: Ẩn số điện thoại và địa chỉ chi tiết
        const addr = customerOrder?.shippingAddress as any;
        const maskedShipping = addr
          ? {
              recipientName: addr.recipientName,
              city: addr.city || addr.provinceCode || '',
            }
          : null;

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
          shippingAddress: maskedShipping,
          items,
          createdAt: fo.createdAt,
          updatedAt: fo.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async syncPostgresOrderSnapshot(
    customerOrderId: string,
    updatedSummary: string,
    updatedOrderStatus: string,
    foId?: string,
    foStatus?: string,
    trackingNo?: string | null,
    carrierCode?: string | null,
  ) {
    if (!this.db) return;
    try {
      const [orderRow] = await this.db.query('SELECT snapshot FROM customer_orders WHERE id = $1', [customerOrderId]);
      if (orderRow?.snapshot) {
        const snap = orderRow.snapshot;
        if (snap.order) {
          snap.order.status = updatedOrderStatus;
          snap.order.fulfillmentSummary = updatedSummary;
          snap.order.updatedAt = new Date().toISOString();
        }
        if (foId && foStatus && snap.fulfillmentOrders) {
          const target = snap.fulfillmentOrders.find((f: any) => f.fulfillmentOrderId === foId);
          if (target) {
            target.status = foStatus;
            if (trackingNo !== undefined) target.trackingNo = trackingNo;
            if (carrierCode !== undefined) target.carrierCode = carrierCode;
          }
        }
        await this.db.query(
          'UPDATE customer_orders SET snapshot = $1, status = $2, fulfillment_summary = $3, updated_at = now() WHERE id = $4',
          [snap, updatedOrderStatus, updatedSummary, customerOrderId],
        );
      }
    } catch {
      // Non-blocking fallback
    }
  }

  /**
   * 2. NHÀ CUNG CẤP BẤM "TIẾP NHẬN ĐƠN HÀNG" (Accept Order)
   * - Đổi trạng thái sang ACCEPTED
   * - Chốt trừ kho thật (StockReservation -> COMMITTED và trừ product.availableStock)
   * - Cập nhật bước "NCC tiếp nhận & Đóng gói" trên màn hình khách hàng
   */
  async acceptOrder(supplierProfileId: string, fulfillmentOrderId: string) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng cần xử lý');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    if (!['PENDING_ACCEPTANCE', 'PENDING'].includes(fo.status)) {
      throw new BadRequestException(`Không thể tiếp nhận đơn hàng ở trạng thái ${fo.status}`);
    }

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder && customerOrder.status === 'PENDING_PAYMENT') {
      throw new BadRequestException('Không thể duyệt đơn hàng chưa hoàn tất thanh toán Online');
    }

    const now = new Date().toISOString();
    fo.status = 'ACCEPTED';
    fo.updatedAt = now;

    // Chốt trừ tồn kho thật: StockReservation chuyển sang COMMITTED và trừ product.availableStock
    const fItems = this.store.fulfillmentItems.filter((fi) => fi.fulfillmentOrderId === fo.id);
    const itemIds = fItems.map((fi) => fi.orderItemId);
    const reservations = this.store.stockReservations.filter(
      (r) => itemIds.includes(r.orderItemId) && r.status === 'HELD',
    );
    for (const res of reservations) {
      res.status = 'COMMITTED';
      const product = this.store.products.find((p) => p.id === res.productId);
      if (product) {
        product.availableStock = Math.max(0, product.availableStock - res.quantity);
        if (product.availableStock === 0) product.status = 'OUT_OF_STOCK';
        product.updatedAt = now;
      }
    }

    // Cập nhật CustomerOrder sang PROCESSING và cập nhật fulfillmentSummary chuẩn
    const allSiblingFos = this.store.fulfillmentOrders.filter(
      (f) => f.customerOrderId === fo.customerOrderId,
    );
    const summary = computeFulfillmentSummary(
      allSiblingFos.map((f) => ({ fulfillmentOrderId: f.id, status: f.status })),
    );

    if (customerOrder) {
      customerOrder.status = 'PROCESSING';
      customerOrder.fulfillmentSummary = summary;
      customerOrder.updatedAt = now;
    }

    // Cập nhật PostgreSQL
    if (this.db) {
      await this.db.query("UPDATE fulfillment_orders SET status = 'ACCEPTED', updated_at = now() WHERE id = $1", [fo.id]).catch(() => {});
      if (itemIds.length > 0) {
        await this.db.query("UPDATE stock_reservations SET status = 'COMMITTED' WHERE order_item_id = ANY($1::uuid[]) AND status = 'HELD'", [itemIds]).catch(() => {});
      }
      for (const res of reservations) {
        await this.db.query("UPDATE products SET available_stock = GREATEST(0, available_stock - $1), updated_at = now() WHERE id = $2", [res.quantity, res.productId]).catch(() => {});
      }
      await this.syncPostgresOrderSnapshot(fo.customerOrderId, summary, 'PROCESSING', fo.id, 'ACCEPTED');
    }

    // Đồng bộ sang DemoCheckoutState nếu có
    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        (agg.order as any).status = 'PROCESSING';
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'ACCEPTED';
        (agg.order as any).fulfillmentSummary = computeFulfillmentSummary(agg.fulfillmentOrders);
        (agg.order as any).updatedAt = now;
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
    carrierCode: string | { carrierCode?: string; trackingNo?: string } = 'GHN_EXPRESS',
    trackingNo: string = `GHN-${Date.now().toString().slice(-8)}`,
  ) {
    const fo = this.store.fulfillmentOrders.find((f) => f.id === fulfillmentOrderId);
    if (!fo) throw new NotFoundException('Không tìm thấy đơn hàng');

    if (fo.supplierId !== supplierProfileId) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
    }

    if (!['ACCEPTED', 'PACKING', 'READY_TO_SHIP'].includes(fo.status)) {
      throw new BadRequestException(`Không thể chuyển sang SHIPPED từ trạng thái ${fo.status}`);
    }

    const finalCarrier = typeof carrierCode === 'object' ? carrierCode.carrierCode || 'GHN_EXPRESS' : carrierCode;
    const finalTracking = typeof carrierCode === 'object' ? carrierCode.trackingNo || `GHN-${Date.now().toString().slice(-8)}` : trackingNo;

    const now = new Date().toISOString();
    fo.status = 'SHIPPED';
    fo.carrierCode = finalCarrier;
    fo.trackingNo = finalTracking;
    fo.updatedAt = now;

    // Cập nhật CustomerOrder dựa trên computeFulfillmentSummary
    const allSiblingFos = this.store.fulfillmentOrders.filter(
      (f) => f.customerOrderId === fo.customerOrderId,
    );
    const summary = computeFulfillmentSummary(
      allSiblingFos.map((f) => ({ fulfillmentOrderId: f.id, status: f.status })),
    );

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder) {
      customerOrder.fulfillmentSummary = summary;
      customerOrder.updatedAt = now;
    }

    if (this.db) {
      await this.db.query(
        "UPDATE fulfillment_orders SET status = 'SHIPPED', carrier_code = $1, tracking_no = $2, updated_at = now() WHERE id = $3",
        [finalCarrier, finalTracking, fo.id],
      ).catch(() => {});
      const currentStatus = customerOrder?.status || 'PROCESSING';
      await this.syncPostgresOrderSnapshot(fo.customerOrderId, summary, currentStatus, fo.id, 'SHIPPED', finalTracking, finalCarrier);
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) {
          (targetFo as any).status = 'SHIPPED';
          (targetFo as any).trackingNo = finalTracking;
          (targetFo as any).carrierCode = finalCarrier;
        }
        (agg.order as any).fulfillmentSummary = computeFulfillmentSummary(agg.fulfillmentOrders);
        (agg.order as any).updatedAt = now;
      }
    }

    this.store.logAudit(
      supplierProfileId,
      'SHIP_FULFILLMENT_ORDER',
      'FULFILLMENT_ORDER',
      fo.id,
      `Giao cho đơn vị vận chuyển ${finalCarrier}. Mã vận đơn: ${finalTracking}`,
    );

    return { success: true, status: 'SHIPPED', trackingNo: finalTracking };
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

    if (!['SHIPPED', 'IN_TRANSIT'].includes(fo.status)) {
      throw new BadRequestException(`Không thể chuyển sang DELIVERED từ trạng thái ${fo.status}`);
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

    // Cập nhật CustomerOrder theo projection chuẩn
    const allSiblingFos = this.store.fulfillmentOrders.filter(
      (f) => f.customerOrderId === fo.customerOrderId,
    );
    const summary = computeFulfillmentSummary(
      allSiblingFos.map((f) => ({ fulfillmentOrderId: f.id, status: f.status })),
    );

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    const newOrderStatus: CustomerOrderStatus = summary === 'COMPLETED' ? 'CLOSED' : (customerOrder?.status || 'PROCESSING');
    if (customerOrder) {
      customerOrder.status = newOrderStatus;
      customerOrder.fulfillmentSummary = summary;
      customerOrder.updatedAt = now;
    }

    if (this.db) {
      await this.db.query("UPDATE fulfillment_orders SET status = 'DELIVERED', updated_at = now() WHERE id = $1", [fo.id]).catch(() => {});
      if (allocation && allocation.status === 'COLLECTED') {
        await this.db.query("UPDATE payment_allocations SET status = 'COLLECTED' WHERE id = $1", [allocation.id]).catch(() => {});
        const payment = this.store.payments.find((p) => p.id === allocation.paymentId);
        if (payment && payment.status === 'COLLECTED') {
          await this.db.query("UPDATE payments SET status = 'COLLECTED', updated_at = now() WHERE id = $1", [payment.id]).catch(() => {});
        }
      }
      await this.syncPostgresOrderSnapshot(fo.customerOrderId, summary, newOrderStatus, fo.id, 'DELIVERED');
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'DELIVERED';
        (agg.order as any).fulfillmentSummary = computeFulfillmentSummary(agg.fulfillmentOrders);
        (agg.order as any).updatedAt = now;
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

    if (!['PENDING_ACCEPTANCE', 'PENDING'].includes(fo.status)) {
      throw new BadRequestException(`Không thể từ chối đơn hàng ở trạng thái ${fo.status}`);
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

    // 3. Cập nhật CustomerOrder dựa trên computeFulfillmentSummary
    const allSiblingFos = this.store.fulfillmentOrders.filter(
      (f) => f.customerOrderId === fo.customerOrderId,
    );
    const summary = computeFulfillmentSummary(
      allSiblingFos.map((f) => ({ fulfillmentOrderId: f.id, status: f.status })),
    );

    const customerOrder = this.store.customerOrders.find((co) => co.id === fo.customerOrderId);
    if (customerOrder) {
      customerOrder.fulfillmentSummary = summary;
      if (summary === 'CANCELED') {
        customerOrder.status = 'CANCELED';
      }
      customerOrder.updatedAt = now;
    }

    if (this.db) {
      await this.db.query("UPDATE fulfillment_orders SET status = 'REJECTED', updated_at = now() WHERE id = $1", [fo.id]).catch(() => {});
      if (itemIds.length > 0) {
        await this.db.query("UPDATE stock_reservations SET status = 'RELEASED' WHERE order_item_id = ANY($1::uuid[]) AND status = 'HELD'", [itemIds]).catch(() => {});
      }
      const newOrderStatus = summary === 'CANCELED' ? 'CANCELED' : (customerOrder?.status || 'PROCESSING');
      await this.syncPostgresOrderSnapshot(fo.customerOrderId, summary, newOrderStatus, fo.id, 'REJECTED');
    }

    if (this.demoState) {
      const agg = this.demoState.orders.get(fo.customerOrderId);
      if (agg) {
        const targetFo = agg.fulfillmentOrders.find((f) => f.fulfillmentOrderId === fo.id);
        if (targetFo) (targetFo as any).status = 'REJECTED';
        (agg.order as any).fulfillmentSummary = computeFulfillmentSummary(agg.fulfillmentOrders);
        if ((agg.order as any).fulfillmentSummary === 'CANCELED') {
          (agg.order as any).status = 'CANCELED';
        }
        (agg.order as any).updatedAt = now;
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
