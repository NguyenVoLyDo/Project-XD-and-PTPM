import { Global, Module, Injectable, Inject, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { CommerceDb } from './commerce-db';
import { CommerceService } from './commerce.service';
import { CommerceController } from './commerce.controller';
import { PostgresCartAdapter } from './cart.adapter';
import { PostgresCheckoutAdapter } from './checkout.adapter';
import { RequestActorAdapter } from '../store-adapters.service';
import * as C from '../../modules/cart/application/ports';
import * as O from '../../modules/orders/application/ports';

@Injectable()
class CartTransactionInterceptor implements NestInterceptor {
  constructor(@Inject(CommerceDb) private readonly db:CommerceDb) {}
  intercept(ctx:ExecutionContext,next:CallHandler) {
    // Includes Cart read-modify-write and price baseline updates in one DB transaction.
    if(ctx.switchToHttp().getRequest().url.split('?')[0].match(/^\/api\/v1\/cart(?:\/|$)/)) return from(this.db.transaction(()=>lastValueFrom(next.handle())));
    return next.handle();
  }
}
const tokens=[C.CART_CURRENT_ACTOR,C.CART_STORE,C.CART_LISTING_PROJECTION,O.ORDERS_CURRENT_ACTOR,O.ORDERS_CART_READER,O.ORDERS_LISTINGS_QUOTE,O.ORDERS_INVENTORY,O.ORDERS_TRANSACTION,O.ORDERS_FULFILLMENT,O.ORDERS_PAYMENTS,O.ORDERS_IDEMPOTENCY,O.ORDERS_ORDER_REPOSITORY,O.ORDERS_OUTBOX,O.ORDERS_PROCESSED_EVENTS];
@Global()
@Module({
  controllers:[CommerceController],
  providers:[CommerceDb,CommerceService,PostgresCartAdapter,PostgresCheckoutAdapter,RequestActorAdapter,
    {provide:APP_INTERCEPTOR,useClass:CartTransactionInterceptor},
    ...[C.CART_CURRENT_ACTOR,O.ORDERS_CURRENT_ACTOR].map(provide=>({provide,useExisting:RequestActorAdapter})),
    ...[C.CART_STORE,C.CART_LISTING_PROJECTION,O.ORDERS_CART_READER].map(provide=>({provide,useExisting:PostgresCartAdapter})),
    ...[O.ORDERS_LISTINGS_QUOTE,O.ORDERS_INVENTORY,O.ORDERS_TRANSACTION,O.ORDERS_FULFILLMENT,O.ORDERS_PAYMENTS,O.ORDERS_OUTBOX,O.ORDERS_PROCESSED_EVENTS].map(provide=>({provide,useExisting:PostgresCheckoutAdapter})),
    {provide:O.ORDERS_IDEMPOTENCY,inject:[PostgresCheckoutAdapter],useFactory:(a:PostgresCheckoutAdapter)=>({find:a.find.bind(a),save:a.saveIdempotency.bind(a)})},
    {provide:O.ORDERS_ORDER_REPOSITORY,inject:[PostgresCheckoutAdapter],useFactory:(a:PostgresCheckoutAdapter)=>({save:a.saveOrder.bind(a),findById:a.findById.bind(a),findByCustomerId:a.findByCustomerId.bind(a)})},
  ],exports:[...tokens,CommerceDb,CommerceService,PostgresCheckoutAdapter],
})
export class PostgresCommerceModule {}
