import { randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  checkoutResponseSchema,
  type CheckoutResponse,
} from "../api/contracts";
import type {
  AllocationDraft,
  CustomerOrder,
  FulfillmentDraftGroup,
  FulfillmentOrderSnapshot,
  OrderItem,
  QuotedCheckoutLine,
} from "../domain/order";
import { CheckoutQuoteService } from "./checkout-quote.service";
import {
  ORDERS_FULFILLMENT,
  ORDERS_IDEMPOTENCY,
  ORDERS_INVENTORY,
  ORDERS_ORDER_REPOSITORY,
  ORDERS_OUTBOX,
  ORDERS_PAYMENTS,
  ORDERS_TRANSACTION,
  type CheckoutExecutionContext,
  type CheckoutExecutorPort,
  type FulfillmentPort,
  type IdempotencyPort,
  type InventoryPort,
  type OrderRepositoryPort,
  type OutboxPort,
  type PaymentsPort,
  type TransactionPort,
} from "./ports";

/**
 * Workflow 5 — Atomic Checkout Creation Service.
 *
 * Runs inside a single transaction context from Common TransactionPort:
 * 1. Revalidates Cart and server quotes via CheckoutQuoteService.
 * 2. Groups items by (supplierId, sellerId) into FulfillmentOrders.
 * 3. Holds stock per item in InventoryPort.
 * 4. Creates Payment obligation and allocations in PaymentsPort.
 * 5. Creates initial fulfillment orders in FulfillmentPort.
 * 6. Records Order snapshot in OrderRepositoryPort.
 * 7. Enqueues OrderCreated in OutboxPort.
 * 8. Records IdempotencyRecord in IdempotencyPort before commit.
 */
@Injectable()
export class AtomicCheckoutService implements CheckoutExecutorPort {
  constructor(
    private readonly quoteService: CheckoutQuoteService,
    @Inject(ORDERS_TRANSACTION)
    private readonly transaction: TransactionPort,
    @Inject(ORDERS_INVENTORY)
    private readonly inventory: InventoryPort,
    @Inject(ORDERS_PAYMENTS)
    private readonly payments: PaymentsPort,
    @Inject(ORDERS_FULFILLMENT)
    private readonly fulfillment: FulfillmentPort,
    @Inject(ORDERS_OUTBOX)
    private readonly outbox: OutboxPort,
    @Inject(ORDERS_IDEMPOTENCY)
    private readonly idempotency: IdempotencyPort,
    @Optional()
    @Inject(ORDERS_ORDER_REPOSITORY)
    private readonly orderRepository?: OrderRepositoryPort,
  ) {}

  async execute(context: CheckoutExecutionContext): Promise<CheckoutResponse> {
    return this.transaction.runInTransaction(async (txContext) => {
      // 1. Revalidate Cart and obtain verified server quote lines
      const quotation = await this.quoteService.quote(
        context.customerId,
        context.request.cartId,
        txContext,
      );

      // 2. Group lines into fulfillment groups by (supplierId, sellerId)
      const groupMap = new Map<
        string,
        {
          fulfillmentOrderId: string;
          supplierId: string;
          sellerId: string;
          lines: QuotedCheckoutLine[];
        }
      >();

      for (const line of quotation.lines) {
        const key = `${line.supplierId}\u0000${line.sellerId}`;
        const existing = groupMap.get(key);
        if (existing) {
          existing.lines.push(line);
        } else {
          groupMap.set(key, {
            fulfillmentOrderId: randomUUID(),
            supplierId: line.supplierId,
            sellerId: line.sellerId,
            lines: [line],
          });
        }
      }

      const orderId = randomUUID();
      const orderNo = this.generateOrderNo();
      const createdAt = new Date().toISOString();
      // TTL: 15 minutes for Online, 24 hours for COD
      const ttlMinutes = context.request.paymentMethod === "ONLINE" ? 15 : 24 * 60;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      // 3. Prepare allocations and hold inventory per line
      const allocationDrafts: AllocationDraft[] = [];
      const orderItems: OrderItem[] = [];
      const groupsData: Array<{
        fulfillmentOrderId: string;
        customerOrderId: string;
        supplierId: string;
        sellerId: string;
        orderItemIds: string[];
        reservationIds: string[];
        amountToCollect: number;
      }> = [];

      for (const group of groupMap.values()) {
        let groupMerchandiseAmount = 0;
        const groupOrderItemIds: string[] = [];
        const groupReservationIds: string[] = [];

        for (const line of group.lines) {
          const orderItemId = randomUUID();
          groupOrderItemIds.push(orderItemId);
          groupMerchandiseAmount += line.lineSaleTotal;

          // Hold stock in Inventory
          const hold = await this.inventory.holdStock(
            txContext,
            orderItemId,
            line.productId,
            line.quantity,
            expiresAt,
          );
          groupReservationIds.push(hold.reservationId);

          orderItems.push({
            orderItemId,
            customerOrderId: orderId,
            fulfillmentOrderId: group.fulfillmentOrderId,
            lineIndex: line.lineIndex,
            listingId: line.listingId,
            productId: line.productId,
            supplierId: line.supplierId,
            sellerId: line.sellerId,
            productName: line.productName,
            listingTitle: line.listingTitle,
            quantity: line.quantity,
            unitSalePrice: line.unitSalePrice,
            unitCostPrice: line.unitCostPrice,
            lineSaleTotal: line.lineSaleTotal,
            lineCostTotal: line.lineCostTotal,
            reservationId: hold.reservationId,
            currency: "VND",
          });
        }

        const amountToCollect = groupMerchandiseAmount; // shipping = 0, discount = 0 in v1
        allocationDrafts.push({
          fulfillmentOrderId: group.fulfillmentOrderId,
          merchandiseAmount: groupMerchandiseAmount,
          shippingAmount: 0,
          discountAmount: 0,
          amountToCollect,
          currency: "VND",
        });

        groupsData.push({
          fulfillmentOrderId: group.fulfillmentOrderId,
          customerOrderId: orderId,
          supplierId: group.supplierId,
          sellerId: group.sellerId,
          orderItemIds: groupOrderItemIds,
          reservationIds: groupReservationIds,
          amountToCollect,
        });
      }

      // 4. Create Payment Obligation
      const obligation = await this.payments.createCheckoutObligation(
        txContext,
        orderId,
        context.request.paymentMethod,
        allocationDrafts,
      );

      // 5. Create Initial in Fulfillment
      const fulfillmentPayload: FulfillmentDraftGroup[] = groupsData.map(
        (group, index) => ({
          fulfillmentOrderId: group.fulfillmentOrderId,
          customerOrderId: orderId,
          supplierId: group.supplierId,
          sellerId: group.sellerId,
          orderItemIds: group.orderItemIds,
          reservationIds: group.reservationIds,
          paymentAllocationId: obligation.allocationIds[index],
          shippingAddress: context.request.shippingAddress,
        }),
      );

      await this.fulfillment.createInitialInCheckout(
        txContext,
        fulfillmentPayload,
      );

      // 6. Record Order aggregate in repository
      const isCod = context.request.paymentMethod === "COD";
      const customerOrder: CustomerOrder = {
        orderId,
        orderNo,
        customerId: context.customerId,
        status: isCod ? "CONFIRMED" : "PENDING_PAYMENT",
        fulfillmentSummary: "UNFULFILLED",
        paymentMethod: context.request.paymentMethod,
        paymentStatus: isCod ? "PENDING_COD" : "PENDING",
        currency: "VND",
        grandTotal: quotation.merchandiseTotal,
        totalPayable: quotation.merchandiseTotal,
        shippingAddress: context.request.shippingAddress,
        ...(isCod ? {} : { paymentIntentId: obligation.paymentIntentId }),
        createdAt,
      };

      const fulfillmentSnapshots: FulfillmentOrderSnapshot[] = groupsData.map(
        (group, index) => ({
          fulfillmentOrderId: group.fulfillmentOrderId,
          customerOrderId: orderId,
          supplierId: group.supplierId,
          sellerId: group.sellerId,
          status: "PENDING_ACCEPTANCE",
          amountToCollect: group.amountToCollect,
          paymentAllocationId: obligation.allocationIds[index],
          orderItemIds: group.orderItemIds,
        }),
      );

      if (this.orderRepository) {
        await this.orderRepository.save(txContext, {
          order: customerOrder,
          items: orderItems,
          fulfillmentOrders: fulfillmentSnapshots,
        });
      }

      // 7. Enqueue OrderCreated outbox event
      await this.outbox.add(txContext, {
        eventId: randomUUID(),
        eventType: "OrderCreated",
        eventVersion: 1,
        aggregateId: orderId,
        occurredAt: createdAt,
        correlationId: randomUUID(),
        payload: {
          orderId,
          fulfillmentOrderIds: groupsData.map((g) => g.fulfillmentOrderId),
        },
      });

      // 8. Build CheckoutResponse
      const responseFulfillmentOrders = groupsData.map((group) => ({
        fulfillmentOrderId: group.fulfillmentOrderId,
        supplierId: group.supplierId,
        sellerId: group.sellerId,
        status: "PENDING_ACCEPTANCE" as const,
        amountToCollect: group.amountToCollect,
      }));

      const rawResponse = isCod
        ? {
            orderId,
            orderNo,
            status: "CONFIRMED" as const,
            fulfillmentSummary: "UNFULFILLED" as const,
            paymentMethod: "COD" as const,
            paymentStatus: "PENDING_COD" as const,
            currency: "VND" as const,
            totalPayable: quotation.merchandiseTotal,
            fulfillmentOrders: responseFulfillmentOrders,
          }
        : {
            orderId,
            orderNo,
            status: "PENDING_PAYMENT" as const,
            fulfillmentSummary: "UNFULFILLED" as const,
            paymentMethod: "ONLINE" as const,
            paymentStatus: "PENDING" as const,
            paymentIntentId: obligation.paymentIntentId,
            currency: "VND" as const,
            totalPayable: quotation.merchandiseTotal,
            fulfillmentOrders: responseFulfillmentOrders,
          };

      const response: CheckoutResponse = checkoutResponseSchema.parse(rawResponse);

      // 9. Save Idempotency Record within the same transaction
      await this.idempotency.save(txContext, {
        customerId: context.customerId,
        key: context.key,
        requestHash: context.requestHash,
        response,
      });

      return response;
    });
  }

  private generateOrderNo(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = randomBytes(2).toString("hex").toUpperCase();
    return `DC-${ts}-${rnd}`;
  }
}
