import { DynamicModule, Module, type Provider } from "@nestjs/common";
import { CheckoutController } from "./api/checkout.controller";
import { AtomicCheckoutService } from "./application/atomic-checkout.service";
import { CheckoutQuoteService } from "./application/checkout-quote.service";
import { CheckoutService } from "./application/checkout.service";
import { OrderEventConsumerService } from "./application/order-event-consumer.service";
import {
  ORDERS_CART_READER,
  ORDERS_CHECKOUT_EXECUTOR,
  ORDERS_CURRENT_ACTOR,
  ORDERS_EVENT_CONSUMER,
  ORDERS_FULFILLMENT,
  ORDERS_IDEMPOTENCY,
  ORDERS_INVENTORY,
  ORDERS_LISTINGS_QUOTE,
  ORDERS_ORDER_REPOSITORY,
  ORDERS_OUTBOX,
  ORDERS_PAYMENTS,
  ORDERS_PROCESSED_EVENTS,
  ORDERS_TRANSACTION,
  type CartReaderPort,
  type CheckoutExecutorPort,
  type CurrentActorPort,
  type FulfillmentPort,
  type IdempotencyPort,
  type InventoryPort,
  type ListingsQuotePort,
  type OrderRepositoryPort,
  type OutboxPort,
  type PaymentsPort,
  type ProcessedEventPort,
  type TransactionPort,
} from "./application/ports";

export interface OrdersModuleAdapters {
  readonly cartReader?: CartReaderPort;
  readonly listingsQuote?: ListingsQuotePort;
  readonly inventory?: InventoryPort;
  readonly currentActor?: CurrentActorPort;
  readonly idempotency?: IdempotencyPort;
  readonly checkoutExecutor?: CheckoutExecutorPort;
  readonly transaction?: TransactionPort;
  readonly payments?: PaymentsPort;
  readonly fulfillment?: FulfillmentPort;
  readonly outbox?: OutboxPort;
  readonly orderRepository?: OrderRepositoryPort;
  readonly processedEvents?: ProcessedEventPort;
}

/**
 * Workflow 5 & 6: Atomic Order Creation, Idempotency, and Domain Event Processing.
 * Provides CheckoutController, CheckoutService, AtomicCheckoutService, CheckoutQuoteService,
 * and OrderEventConsumerService.
 */
@Module({
  controllers: [CheckoutController],
  providers: [
    CheckoutQuoteService,
    AtomicCheckoutService,
    CheckoutService,
    OrderEventConsumerService,
    {
      provide: ORDERS_CHECKOUT_EXECUTOR,
      useExisting: AtomicCheckoutService,
    },
    {
      provide: ORDERS_EVENT_CONSUMER,
      useExisting: OrderEventConsumerService,
    },
  ],
  exports: [
    CheckoutQuoteService,
    AtomicCheckoutService,
    CheckoutService,
    OrderEventConsumerService,
  ],
})
export class OrdersModule {
  static register(adapters: OrdersModuleAdapters): DynamicModule {
    const providers: Provider[] = [];

    if (adapters.cartReader) {
      providers.push({
        provide: ORDERS_CART_READER,
        useValue: adapters.cartReader,
      });
    }
    if (adapters.listingsQuote) {
      providers.push({
        provide: ORDERS_LISTINGS_QUOTE,
        useValue: adapters.listingsQuote,
      });
    }
    if (adapters.inventory) {
      providers.push({
        provide: ORDERS_INVENTORY,
        useValue: adapters.inventory,
      });
    }
    if (adapters.currentActor) {
      providers.push({
        provide: ORDERS_CURRENT_ACTOR,
        useValue: adapters.currentActor,
      });
    }
    if (adapters.idempotency) {
      providers.push({
        provide: ORDERS_IDEMPOTENCY,
        useValue: adapters.idempotency,
      });
    }
    if (adapters.checkoutExecutor) {
      providers.push({
        provide: ORDERS_CHECKOUT_EXECUTOR,
        useValue: adapters.checkoutExecutor,
      });
    }
    if (adapters.transaction) {
      providers.push({
        provide: ORDERS_TRANSACTION,
        useValue: adapters.transaction,
      });
    }
    if (adapters.payments) {
      providers.push({
        provide: ORDERS_PAYMENTS,
        useValue: adapters.payments,
      });
    }
    if (adapters.fulfillment) {
      providers.push({
        provide: ORDERS_FULFILLMENT,
        useValue: adapters.fulfillment,
      });
    }
    if (adapters.outbox) {
      providers.push({
        provide: ORDERS_OUTBOX,
        useValue: adapters.outbox,
      });
    }
    if (adapters.orderRepository) {
      providers.push({
        provide: ORDERS_ORDER_REPOSITORY,
        useValue: adapters.orderRepository,
      });
    }
    if (adapters.processedEvents) {
      providers.push({
        provide: ORDERS_PROCESSED_EVENTS,
        useValue: adapters.processedEvents,
      });
    }

    return {
      module: OrdersModule,
      providers,
    };
  }
}
