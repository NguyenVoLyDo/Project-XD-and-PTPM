import { DynamicModule, Module } from "@nestjs/common";
import { CheckoutQuoteService } from "./application/checkout-quote.service";
import {
  ORDERS_CART_READER,
  ORDERS_INVENTORY,
  ORDERS_LISTINGS_QUOTE,
  type CartReaderPort,
  type InventoryPort,
  type ListingsQuotePort,
} from "./application/ports";

export interface OrdersModuleAdapters {
  readonly cartReader: CartReaderPort;
  readonly listingsQuote: ListingsQuotePort;
  readonly inventory: InventoryPort;
}

/**
 * Workflow 3: checkout revalidation/quote. The checkout controller arrives in
 * Workflow 4; the composition root binds the consumer ports via `register`.
 */
@Module({
  providers: [CheckoutQuoteService],
  exports: [CheckoutQuoteService],
})
export class OrdersModule {
  static register(adapters: OrdersModuleAdapters): DynamicModule {
    return {
      module: OrdersModule,
      providers: [
        { provide: ORDERS_CART_READER, useValue: adapters.cartReader },
        { provide: ORDERS_LISTINGS_QUOTE, useValue: adapters.listingsQuote },
        { provide: ORDERS_INVENTORY, useValue: adapters.inventory },
      ],
    };
  }
}
