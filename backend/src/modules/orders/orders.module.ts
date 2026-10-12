import { DynamicModule, Module, type Provider } from "@nestjs/common";
import { CheckoutController } from "./api/checkout.controller";
import { CheckoutQuoteService } from "./application/checkout-quote.service";
import { CheckoutService } from "./application/checkout.service";
import {
  ORDERS_CART_READER,
  ORDERS_CHECKOUT_EXECUTOR,
  ORDERS_CURRENT_ACTOR,
  ORDERS_IDEMPOTENCY,
  ORDERS_INVENTORY,
  ORDERS_LISTINGS_QUOTE,
  type CartReaderPort,
  type CheckoutExecutorPort,
  type CurrentActorPort,
  type IdempotencyPort,
  type InventoryPort,
  type ListingsQuotePort,
} from "./application/ports";

export interface OrdersModuleAdapters {
  readonly cartReader?: CartReaderPort;
  readonly listingsQuote?: ListingsQuotePort;
  readonly inventory?: InventoryPort;
  readonly currentActor?: CurrentActorPort;
  readonly idempotency?: IdempotencyPort;
  readonly checkoutExecutor?: CheckoutExecutorPort;
}

/**
 * Workflow 4: Checkout API and Idempotency.
 * Provides CheckoutController, CheckoutService, and CheckoutQuoteService.
 */
@Module({
  controllers: [CheckoutController],
  providers: [CheckoutQuoteService, CheckoutService],
  exports: [CheckoutQuoteService, CheckoutService],
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

    return {
      module: OrdersModule,
      providers,
    };
  }
}
