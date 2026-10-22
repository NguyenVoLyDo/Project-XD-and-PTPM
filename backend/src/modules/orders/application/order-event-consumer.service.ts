import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  CustomerOrder,
  DomainEventEnvelope,
  FulfillmentOrderSnapshot,
  OrderAggregate,
} from "../domain/order";
import { computeFulfillmentSummary } from "../domain/fulfillment-projection";
import {
  ORDERS_ORDER_REPOSITORY,
  ORDERS_OUTBOX,
  ORDERS_PROCESSED_EVENTS,
  ORDERS_TRANSACTION,
  type EventProcessingResult,
  type OrderEventConsumerPort,
  type OrderRepositoryPort,
  type OutboxPort,
  type ProcessedEventPort,
  type TransactionPort,
} from "./ports";

@Injectable()
export class OrderEventConsumerService implements OrderEventConsumerPort {
  constructor(
    @Inject(ORDERS_TRANSACTION)
    private readonly transaction: TransactionPort,
    @Inject(ORDERS_ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(ORDERS_OUTBOX)
    private readonly outbox: OutboxPort,
    @Inject(ORDERS_PROCESSED_EVENTS)
    private readonly processedEvents: ProcessedEventPort,
  ) {}

  async consume(
    event: DomainEventEnvelope<Record<string, unknown>>,
  ): Promise<EventProcessingResult> {
    return this.transaction.runInTransaction(async (txContext) => {
      // 1. Deduplication check
      const alreadyProcessed = await this.processedEvents.isProcessed(
        event.eventId,
      );
      if (alreadyProcessed) {
        const orderId =
          (event.payload?.orderId as string | undefined) ?? event.aggregateId;
        const existing = await this.orderRepository.findById(orderId);
        return {
          status: "IGNORED_DUPLICATE",
          order: existing?.order,
          reason: `Event ${event.eventId} already processed`,
        };
      }

      // 2. Identify target order
      const orderId =
        (event.payload?.orderId as string | undefined) ?? event.aggregateId;
      const aggregate = await this.orderRepository.findById(orderId);
      if (!aggregate) {
        return {
          status: "ORDER_NOT_FOUND",
          reason: `Order ${orderId} not found`,
        };
      }

      let currentOrder: CustomerOrder = aggregate.order;
      let currentFulfillmentOrders: FulfillmentOrderSnapshot[] = [
        ...aggregate.fulfillmentOrders,
      ];
      const now = event.occurredAt || new Date().toISOString();

      // 3. Dispatch by eventType
      switch (event.eventType) {
        case "PaymentSucceeded": {
          if (currentOrder.status === "PENDING_PAYMENT") {
            currentOrder = {
              ...currentOrder,
              status: "CONFIRMED",
              paymentStatus: "PAID",
              updatedAt: now,
            };

            // Emit OrderConfirmed outbox event once upon successful confirmation
            await this.outbox.add(txContext, {
              eventId: randomUUID(),
              eventType: "OrderConfirmed",
              eventVersion: 1,
              aggregateId: currentOrder.orderId,
              occurredAt: now,
              correlationId: event.correlationId || randomUUID(),
              payload: {
                orderId: currentOrder.orderId,
                fulfillmentOrderIds: currentFulfillmentOrders.map(
                  (f) => f.fulfillmentOrderId,
                ),
              },
            });
          }
          break;
        }

        case "PaymentFailed": {
          if (currentOrder.status === "PENDING_PAYMENT") {
            currentOrder = {
              ...currentOrder,
              status: "PAYMENT_FAILED",
              paymentStatus: "FAILED",
              updatedAt: now,
            };
          }
          break;
        }

        case "PaymentTimedOut": {
          if (
            currentOrder.status === "PENDING_PAYMENT" ||
            currentOrder.status === "PAYMENT_FAILED"
          ) {
            currentFulfillmentOrders = currentFulfillmentOrders.map((fo) => ({
              ...fo,
              status: "CANCELED" as const,
              reasonCode:
                (event.payload?.reasonCode as string | undefined) ??
                "ONLINE_PAYMENT_EXPIRED",
              sourceRef:
                (event.payload?.sourceRef as string | undefined) ??
                event.eventId,
              updatedAt: now,
            }));

            currentOrder = {
              ...currentOrder,
              status: "CANCELED",
              paymentStatus: "FAILED",
              fulfillmentSummary: "CANCELED",
              totalPayable: 0,
              updatedAt: now,
            };
          }
          break;
        }

        case "PaymentCollected": {
          if (currentOrder.paymentStatus === "PENDING_COD") {
            currentOrder = {
              ...currentOrder,
              paymentStatus: "COLLECTED",
              updatedAt: now,
            };
          }
          break;
        }

        case "RefundCompleted": {
          const isPartial = event.payload?.isPartial === true;
          currentOrder = {
            ...currentOrder,
            paymentStatus: isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED",
            updatedAt: now,
          };
          break;
        }

        case "FulfillmentAccepted": {
          const foId = event.payload?.fulfillmentOrderId as string | undefined;
          currentFulfillmentOrders = currentFulfillmentOrders.map((fo) =>
            fo.fulfillmentOrderId === foId
              ? { ...fo, status: "ACCEPTED" as const, updatedAt: now }
              : fo,
          );

          // If order is CONFIRMED and processing starts, transition order status to PROCESSING
          const newStatus =
            currentOrder.status === "CONFIRMED"
              ? "PROCESSING"
              : currentOrder.status;

          currentOrder = {
            ...currentOrder,
            status: newStatus,
            fulfillmentSummary: computeFulfillmentSummary(
              currentFulfillmentOrders,
            ),
            updatedAt: now,
          };
          break;
        }

        case "FulfillmentRejected": {
          const foId = event.payload?.fulfillmentOrderId as string | undefined;
          const reasonCode =
            (event.payload?.reasonCode as string | undefined) ?? "REJECTED";
          const sourceRef =
            (event.payload?.sourceRef as string | undefined) ?? event.eventId;

          currentFulfillmentOrders = currentFulfillmentOrders.map((fo) =>
            fo.fulfillmentOrderId === foId
              ? {
                  ...fo,
                  status: "REJECTED" as const,
                  reasonCode,
                  sourceRef,
                  updatedAt: now,
                }
              : fo,
          );

          const newSummary = computeFulfillmentSummary(currentFulfillmentOrders);
          const activeFos = currentFulfillmentOrders.filter(
            (fo) => fo.status !== "REJECTED" && fo.status !== "CANCELED",
          );
          const newTotalPayable = activeFos.reduce(
            (sum, fo) => sum + fo.amountToCollect,
            0,
          );

          let newOrderStatus = currentOrder.status;
          let newPaymentStatus = currentOrder.paymentStatus;

          if (newSummary === "CANCELED") {
            newOrderStatus = "CANCELED";
            if (currentOrder.paymentMethod === "COD") {
              newPaymentStatus = "VOIDED";
            }
          }

          currentOrder = {
            ...currentOrder,
            status: newOrderStatus,
            fulfillmentSummary: newSummary,
            paymentStatus: newPaymentStatus,
            totalPayable: newTotalPayable,
            updatedAt: now,
          };
          break;
        }

        case "FulfillmentTimedOut": {
          const foId = event.payload?.fulfillmentOrderId as string | undefined;
          const reasonCode =
            (event.payload?.reasonCode as string | undefined) ??
            "SUPPLIER_TIMEOUT";
          const sourceRef =
            (event.payload?.sourceRef as string | undefined) ?? event.eventId;

          currentFulfillmentOrders = currentFulfillmentOrders.map((fo) =>
            fo.fulfillmentOrderId === foId
              ? {
                  ...fo,
                  status: "CANCELED" as const,
                  reasonCode,
                  sourceRef,
                  updatedAt: now,
                }
              : fo,
          );

          const newSummary = computeFulfillmentSummary(currentFulfillmentOrders);
          const activeFos = currentFulfillmentOrders.filter(
            (fo) => fo.status !== "REJECTED" && fo.status !== "CANCELED",
          );
          const newTotalPayable = activeFos.reduce(
            (sum, fo) => sum + fo.amountToCollect,
            0,
          );

          let newOrderStatus = currentOrder.status;
          let newPaymentStatus = currentOrder.paymentStatus;

          if (newSummary === "CANCELED") {
            newOrderStatus = "CANCELED";
            if (currentOrder.paymentMethod === "COD") {
              newPaymentStatus = "VOIDED";
            }
          }

          currentOrder = {
            ...currentOrder,
            status: newOrderStatus,
            fulfillmentSummary: newSummary,
            paymentStatus: newPaymentStatus,
            totalPayable: newTotalPayable,
            updatedAt: now,
          };
          break;
        }

        case "FulfillmentShipped": {
          const foId = event.payload?.fulfillmentOrderId as string | undefined;
          const trackingNo = event.payload?.trackingNo as string | undefined;
          const carrierCode = event.payload?.carrierCode as string | undefined;

          currentFulfillmentOrders = currentFulfillmentOrders.map((fo) =>
            fo.fulfillmentOrderId === foId
              ? {
                  ...fo,
                  status: "SHIPPED" as const,
                  trackingNo,
                  carrierCode,
                  updatedAt: now,
                }
              : fo,
          );

          currentOrder = {
            ...currentOrder,
            fulfillmentSummary: computeFulfillmentSummary(
              currentFulfillmentOrders,
            ),
            updatedAt: now,
          };
          break;
        }

        case "FulfillmentDelivered": {
          const foId = event.payload?.fulfillmentOrderId as string | undefined;

          currentFulfillmentOrders = currentFulfillmentOrders.map((fo) =>
            fo.fulfillmentOrderId === foId
              ? { ...fo, status: "DELIVERED" as const, updatedAt: now }
              : fo,
          );

          currentOrder = {
            ...currentOrder,
            fulfillmentSummary: computeFulfillmentSummary(
              currentFulfillmentOrders,
            ),
            updatedAt: now,
          };
          break;
        }

        default:
          // Unhandled event types are safely ignored without error
          break;
      }

      // 4. Persist updated aggregate
      const updatedAggregate: OrderAggregate = {
        order: currentOrder,
        items: aggregate.items,
        fulfillmentOrders: currentFulfillmentOrders,
      };
      await this.orderRepository.save(txContext, updatedAggregate);

      // 5. Record processed event for deduplication
      await this.processedEvents.record(txContext, {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: currentOrder.orderId,
        processedAt: now,
        sourceRef:
          (event.payload?.sourceRef as string | undefined) ?? event.eventId,
        reasonCode: event.payload?.reasonCode as string | undefined,
      });

      return {
        status: "PROCESSED",
        order: currentOrder,
      };
    });
  }
}
