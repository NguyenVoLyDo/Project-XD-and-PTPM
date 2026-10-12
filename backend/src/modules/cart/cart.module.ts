import { DynamicModule, Module } from "@nestjs/common";
import { CartController } from "./api/cart.controller";
import { CartService } from "./application/cart.service";
import {
  CART_CURRENT_ACTOR,
  CART_LISTING_PROJECTION,
  CART_STORE,
  type CartListingProjectionPort,
  type CartStorePort,
  type CurrentActorPort,
} from "./application/ports";

export interface CartModuleAdapters {
  readonly currentActor: CurrentActorPort;
  readonly store: CartStorePort;
  readonly listingProjection: CartListingProjectionPort;
}

/**
 * Workflow 2 HTTP/API layer. The composition root binds the three public ports
 * with CartModule's injection tokens when the real adapters are integrated.
 */
@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {
  static register(adapters: CartModuleAdapters): DynamicModule {
    return {
      module: CartModule,
      providers: [
        { provide: CART_CURRENT_ACTOR, useValue: adapters.currentActor },
        { provide: CART_STORE, useValue: adapters.store },
        {
          provide: CART_LISTING_PROJECTION,
          useValue: adapters.listingProjection,
        },
      ],
    };
  }
}
