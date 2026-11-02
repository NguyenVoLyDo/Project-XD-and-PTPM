import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CommerceDb, uuid } from './commerce-db';
import { CommerceService } from './commerce.service';
import { CartStorePort, CartListingProjectionPort, ListingProjection } from '../../modules/cart/application/ports';
import { CartSnapshot } from '../../modules/cart/domain/cart';

@Injectable()
export class PostgresCartAdapter implements CartStorePort, CartListingProjectionPort {
  constructor(@Inject(CommerceDb) readonly db:CommerceDb,@Inject(CommerceService) readonly commerce:CommerceService) {}
  async getByCustomerId(customerId:string):Promise<CartSnapshot> {
    const [cart] = await this.db.query('INSERT INTO carts(customer_id) VALUES($1) ON CONFLICT(customer_id) DO UPDATE SET customer_id=EXCLUDED.customer_id RETURNING id', [uuid(customerId)]);
    const items = await this.db.query('SELECT listing_id AS "listingId",quantity,last_viewed_unit_sale_price AS baseline FROM cart_items WHERE cart_id=$1 ORDER BY created_at,id',[cart.id]);
    return {cartId:cart.id,customerId,items:items.map(i=>({listingId:i.listingId,quantity:i.quantity,...(i.baseline===null?{}:{lastViewedUnitSalePrice:Number(i.baseline)})}))};
  }
  async save(cart:CartSnapshot) {
    await this.db.transaction(async()=>{
      await this.db.query('INSERT INTO carts(id,customer_id) VALUES($1,$2) ON CONFLICT(customer_id) DO NOTHING',[cart.cartId,cart.customerId]);
      await this.db.query('DELETE FROM cart_items WHERE cart_id=$1 AND NOT(listing_id=ANY($2::uuid[]))',[cart.cartId,cart.items.map(i=>uuid(i.listingId))]);
      for(const i of cart.items) await this.db.query(`INSERT INTO cart_items(id,cart_id,listing_id,quantity,last_viewed_unit_sale_price) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(cart_id,listing_id) DO UPDATE SET quantity=EXCLUDED.quantity,last_viewed_unit_sale_price=EXCLUDED.last_viewed_unit_sale_price,updated_at=now()`,[randomUUID(),cart.cartId,i.listingId,i.quantity,i.lastViewedUnitSalePrice??null]);
    });
  }
  async getForCheckout(customerId:string) { return this.getByCustomerId(customerId); }
  async getForCart(ids:readonly string[]):Promise<readonly ListingProjection[]> {
    ids.forEach(uuid);
    const rows=await this.commerce.listingRows(undefined, ids);
    return Promise.all(rows.map(async r=>({listingId:r.id,title:r.product_name,unitSalePrice:Number(r.sale_price),currency:'VND' as const,
      availability: this.commerce.eligible(r) && Number(r.available_stock)-Number(r.reserved)>0?'AVAILABLE' as const:'UNAVAILABLE' as const,
      unavailableCode:r.status==='PAUSED_BY_POLICY'?'LISTING_PAUSED_BY_POLICY' as const:'LISTING_UNAVAILABLE' as const})));
  }
}
