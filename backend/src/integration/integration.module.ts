import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "../common/database/database.module";
import { InventoryModule } from "../modules/inventory/inventory.module";
import {
  CartIntegrationAdapter,
  DemoCheckoutState,
  OrdersCatalogInventoryAdapter,
  OrdersExecutionAdapter,
  OrdersIdempotencyAdapter,
  OrdersRepositoryAdapter,
  RequestActorAdapter,
} from "./store-adapters.service";
import {
  CART_CURRENT_ACTOR,
  CART_LISTING_PROJECTION,
  CART_STORE,
} from "../modules/cart/application/ports";
import {
  ORDERS_CART_READER,
  ORDERS_CURRENT_ACTOR,
  ORDERS_FULFILLMENT,
  ORDERS_IDEMPOTENCY,
  ORDERS_INVENTORY,
  ORDERS_LISTINGS_QUOTE,
  ORDERS_ORDER_REPOSITORY,
  ORDERS_OUTBOX,
  ORDERS_PAYMENTS,
  ORDERS_PROCESSED_EVENTS,
  ORDERS_TRANSACTION,
} from "../modules/orders/application/ports";

@Global()
@Module({
  imports: [DatabaseModule, InventoryModule],
  providers: [
    RequestActorAdapter,
    CartIntegrationAdapter,
    DemoCheckoutState,
    OrdersCatalogInventoryAdapter,
    OrdersIdempotencyAdapter,
    OrdersRepositoryAdapter,
    OrdersExecutionAdapter,
    {
      provide: CART_CURRENT_ACTOR,
      useExisting: RequestActorAdapter,
    },
    {
      provide: CART_STORE,
      useExisting: CartIntegrationAdapter,
    },
    {
      provide: CART_LISTING_PROJECTION,
      useExisting: CartIntegrationAdapter,
    },
    {
      provide: ORDERS_CURRENT_ACTOR,
      useExisting: RequestActorAdapter,
    },
    {
      provide: ORDERS_CART_READER,
      useExisting: CartIntegrationAdapter,
    },
    {
      provide: ORDERS_LISTINGS_QUOTE,
      useExisting: OrdersCatalogInventoryAdapter,
    },
    {
      provide: ORDERS_INVENTORY,
      useExisting: OrdersCatalogInventoryAdapter,
    },
    {
      provide: ORDERS_TRANSACTION,
      useExisting: OrdersCatalogInventoryAdapter,
    },
    {
      provide: ORDERS_FULFILLMENT,
      useExisting: OrdersExecutionAdapter,
    },
    {
      provide: ORDERS_PAYMENTS,
      useExisting: OrdersExecutionAdapter,
    },
    {
      provide: ORDERS_IDEMPOTENCY,
      useExisting: OrdersIdempotencyAdapter,
    },
    {
      provide: ORDERS_OUTBOX,
      useExisting: OrdersExecutionAdapter,
    },
    {
      provide: ORDERS_ORDER_REPOSITORY,
      useExisting: OrdersRepositoryAdapter,
    },
    {
      provide: ORDERS_PROCESSED_EVENTS,
      useExisting: OrdersExecutionAdapter,
    },
  ],
  exports: [
    RequestActorAdapter,
    CartIntegrationAdapter,
    DemoCheckoutState,
    OrdersCatalogInventoryAdapter,
    OrdersIdempotencyAdapter,
    OrdersRepositoryAdapter,
    OrdersExecutionAdapter,
    CART_CURRENT_ACTOR,
    CART_STORE,
    CART_LISTING_PROJECTION,
    ORDERS_CURRENT_ACTOR,
    ORDERS_CART_READER,
    ORDERS_LISTINGS_QUOTE,
    ORDERS_INVENTORY,
    ORDERS_TRANSACTION,
    ORDERS_FULFILLMENT,
    ORDERS_PAYMENTS,
    ORDERS_IDEMPOTENCY,
    ORDERS_OUTBOX,
    ORDERS_ORDER_REPOSITORY,
    ORDERS_PROCESSED_EVENTS,
  ],
})
export class IntegrationModule {}
