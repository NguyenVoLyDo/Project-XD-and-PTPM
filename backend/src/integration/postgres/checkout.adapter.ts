import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CommerceDb, fail, uuid } from './commerce-db';
import { CommerceService } from './commerce.service';
import type { CheckoutTransactionContext, IdempotencyRecord, PaginationQuery, ProcessedEventRecord } from '../../modules/orders/application/ports';
import type { OrderAggregate, OutboxEvent, AllocationDraft, PaymentMethod, FulfillmentDraftGroup, CheckoutQuoteBatch } from '../../modules/orders/domain/order';

@Injectable()
export class PostgresCheckoutAdapter {
  constructor(@Inject(CommerceDb) readonly db:CommerceDb,@Inject(CommerceService) readonly commerce:CommerceService) {}
  async runInTransaction<T>(work:(ctx:CheckoutTransactionContext)=>Promise<T>):Promise<T> { return this.db.transaction(()=>work({token:this.db})); }
  async getCheckoutQuotes(ids:readonly string[]):Promise<CheckoutQuoteBatch> {
    ids.forEach(uuid);
    const rows=await this.commerce.listingRows(); const quotes:any[]=[],rejections:any[]=[];
    for(const id of ids) {
      const r=rows.find(r=>r.id===id);
      if(!r) {rejections.push({listingId:id,code:'LISTING_NOT_FOUND'});continue;}
      if(!this.commerce.eligible(r)) {rejections.push({listingId:id,code:r.status==='PAUSED_BY_POLICY'?'LISTING_PAUSED_BY_POLICY':'LISTING_UNAVAILABLE'});continue;}
      quotes.push({listingId:r.id,productId:r.product_id,supplierId:r.supplier_id,sellerId:r.seller_id,productName:r.product_name,listingTitle:r.product_name,unitCostPrice:Number(r.cost_price),unitSalePrice:Number(r.sale_price),currency:'VND',status:'ACTIVE'});
    }
    return {quotes,rejections};
  }
  async getAvailability(productId:string) { return (await this.commerce.stock(productId)).available; }
  async holdStock(ctx:CheckoutTransactionContext,orderItemId:string,productId:string,quantity:number,expiresAt:string) {
    if(!this.db.inTransaction || ctx.token!==this.db) throw new Error('Transaction required');
    await this.db.query('SELECT id FROM products WHERE id=$1 FOR UPDATE',[uuid(productId)]);
    const [existing]=await this.db.query('SELECT * FROM stock_reservations WHERE order_item_id=$1',[orderItemId]);
    if(existing) return {reservationId:existing.id,orderItemId,quantity:existing.quantity,status:'HELD',expiresAt:existing.expires_at.toISOString()};
    if(await this.getAvailability(productId)<quantity) fail(409,'INSUFFICIENT_STOCK');
    const [row]=await this.db.query("INSERT INTO stock_reservations(order_item_id,product_id,quantity,status,expires_at) VALUES($1,$2,$3,'HELD',$4) RETURNING id",[orderItemId,productId,quantity,expiresAt]);
    return {reservationId:row.id,orderItemId,quantity,status:'HELD',expiresAt};
  }
  async find(customerId:string,key:string):Promise<IdempotencyRecord|null> {
    const [r]=await this.db.query('SELECT * FROM idempotency_keys WHERE customer_id=$1 AND key=$2',[customerId,key]);
    return r?{customerId,key,requestHash:r.request_hash,response:r.response_body}:null;
  }
  async saveIdempotency(ctx:CheckoutTransactionContext,r:IdempotencyRecord) {
    await this.db.query('INSERT INTO idempotency_keys(customer_id,key,request_hash,response_body) VALUES($1,$2,$3,$4)',[r.customerId,r.key,r.requestHash,r.response]);
  }
  async saveOrder(ctx:CheckoutTransactionContext,agg:OrderAggregate) {
    const o=agg.order;
    // Fulfillment owns normalized parcel state. Never accept a projection-only
    // transition: its owner must persist the transition before publishing it.
    const previous = await this.findById(o.orderId);
    for (const parcel of agg.fulfillmentOrders) {
      const old = previous?.fulfillmentOrders.find(item => item.fulfillmentOrderId === parcel.fulfillmentOrderId);
      if (!old || old.status === parcel.status) continue;
      const [source] = await this.db.query('SELECT status FROM fulfillment_orders WHERE id=$1 AND customer_order_id=$2', [parcel.fulfillmentOrderId, o.orderId]);
      if (source?.status !== parcel.status) fail(409, 'FULFILLMENT_SOURCE_NOT_COMMITTED', 'Fulfillment must persist its transition before Orders consumes the event');
    }
    await this.db.query(`INSERT INTO customer_orders(id,order_no,customer_id,status,fulfillment_summary,grand_total,total_payable,placed_at,snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,fulfillment_summary=EXCLUDED.fulfillment_summary,total_payable=EXCLUDED.total_payable,snapshot=EXCLUDED.snapshot,updated_at=now()`,[o.orderId,o.orderNo,o.customerId,o.status,o.fulfillmentSummary,o.grandTotal,o.totalPayable,o.createdAt,agg]);
    for(const i of agg.items) {
      await this.db.query(`INSERT INTO order_items(id,customer_order_id,listing_id,product_name_snapshot,quantity,unit_sale_price_snapshot,unit_cost_price_snapshot)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,[i.orderItemId,i.customerOrderId,i.listingId,i.productName,i.quantity,i.unitSalePrice,i.unitCostPrice]);
      await this.db.query('INSERT INTO fulfillment_items(fulfillment_order_id,order_item_id,quantity,item_gross_snapshot) VALUES($1,$2,$3,$4) ON CONFLICT(fulfillment_order_id,order_item_id) DO NOTHING',[i.fulfillmentOrderId,i.orderItemId,i.quantity,i.lineSaleTotal]);
    }
  }
  async findById(id:string):Promise<OrderAggregate|null> { const [r]=await this.db.query('SELECT snapshot FROM customer_orders WHERE id=$1',[uuid(id)]); return r?.snapshot||null; }
  async findByCustomerId(id:string,p:PaginationQuery={}) {
    const page=p.page||1,limit=p.limit||20;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page-1)*limit) || (page-1)*limit > 2147483647) fail(400, 'INVALID_REQUEST');
    const [count]=await this.db.query('SELECT count(*)::int AS total FROM customer_orders WHERE customer_id=$1',[id]);
    const rows=await this.db.query('SELECT snapshot FROM customer_orders WHERE customer_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',[id,limit,(page-1)*limit]);
    return {items:rows.map(r=>r.snapshot),total:count.total,page,limit,totalPages:Math.max(1,Math.ceil(count.total/limit))};
  }
  async createInitialInCheckout(ctx:CheckoutTransactionContext,groups:readonly FulfillmentDraftGroup[]) {
    for(const g of groups) await this.db.query("INSERT INTO fulfillment_orders(id,fulfillment_no,customer_order_id,supplier_id,seller_id,status) VALUES($1,$2,$3,$4,$5,'PENDING_ACCEPTANCE')",[g.fulfillmentOrderId,'FF-'+g.fulfillmentOrderId,g.customerOrderId,g.supplierId,g.sellerId]);
  }
  async createCheckoutObligation(ctx:CheckoutTransactionContext,id:string,method:PaymentMethod,allocations:readonly AllocationDraft[]) {
    const paymentId=randomUUID(),paymentIntentId=randomUUID(),allocationIds=allocations.map(()=>randomUUID());
    const total=allocations.reduce((n,a)=>n+a.amountToCollect,0),status=method==='COD'?'PENDING_COD':'PENDING';
    await this.db.query("INSERT INTO payment_intents(id,customer_order_id,provider,amount,status) VALUES($1,$2,'INTERNAL_OBLIGATION',$3,$4)",[paymentIntentId,id,total,status]);
    await this.db.query('INSERT INTO payments(id,customer_order_id,payment_intent_id,method,status,amount) VALUES($1,$2,$3,$4,$5,$6)',[paymentId,id,paymentIntentId,method,status,total]);
    for(let i=0;i<allocations.length;i++) {const a=allocations[i];await this.db.query('INSERT INTO payment_allocations(id,payment_id,fulfillment_order_id,merchandise_amount,shipping_amount,discount_amount,amount_to_collect) VALUES($1,$2,$3,$4,$5,$6,$7)',[allocationIds[i],paymentId,a.fulfillmentOrderId,a.merchandiseAmount,a.shippingAmount,a.discountAmount,a.amountToCollect]);}
    return {paymentId,paymentIntentId,status,allocationIds};
  }
  async add(ctx:CheckoutTransactionContext,e:OutboxEvent) {
    await this.db.query("INSERT INTO outbox_events(id,aggregate_type,aggregate_id,event_type,payload,occurred_at) VALUES($1,'CustomerOrder',$2,$3,$4,$5)",[e.eventId,e.aggregateId,e.eventType,e,e.occurredAt]);
    const recipients=await this.db.query(`SELECT customer_id AS id FROM customer_orders WHERE id=$1 UNION SELECT sp.user_id FROM fulfillment_orders f JOIN supplier_profiles sp ON sp.id=f.supplier_id WHERE f.customer_order_id=$1 UNION SELECT sp.user_id FROM fulfillment_orders f JOIN seller_profiles sp ON sp.id=f.seller_id WHERE f.customer_order_id=$1`,[e.aggregateId]);
    await this.db.notify(e.eventId,e.eventType,e.payload,recipients.map(r=>r.id));
    const [order]=await this.db.query('SELECT customer_id FROM customer_orders WHERE id=$1',[e.aggregateId]);
    if(order) await this.db.audit(order.customer_id,e.eventType,'CustomerOrder',e.aggregateId);
  }
  async isProcessed(id:string) { return (await this.db.query('SELECT event_id FROM processed_order_events WHERE event_id=$1',[id])).length>0; }
  async record(ctx:CheckoutTransactionContext,r:ProcessedEventRecord) { await this.db.query('INSERT INTO processed_order_events(event_id,event_type,aggregate_id,processed_at,source_ref,reason_code) VALUES($1,$2,$3,$4,$5,$6)',[r.eventId,r.eventType,r.aggregateId,r.processedAt,r.sourceRef||null,r.reasonCode||null]); }
}
