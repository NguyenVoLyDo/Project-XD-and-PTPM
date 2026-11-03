import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CommerceDb, fail, uuid } from './commerce-db';
import { CommerceService } from './commerce.service';
import { StoreService } from '../../common/database/store.service';
import type { CheckoutTransactionContext, IdempotencyRecord, PaginationQuery, ProcessedEventRecord } from '../../modules/orders/application/ports';
import type { OrderAggregate, OutboxEvent, AllocationDraft, PaymentMethod, FulfillmentDraftGroup, CheckoutQuoteBatch } from '../../modules/orders/domain/order';

@Injectable()
export class PostgresCheckoutAdapter {
  constructor(
    @Inject(CommerceDb) readonly db: CommerceDb,
    @Inject(CommerceService) readonly commerce: CommerceService,
    @Optional() @Inject(StoreService) private readonly store?: StoreService,
  ) {}
  async runInTransaction<T>(work:(ctx:CheckoutTransactionContext)=>Promise<T>):Promise<T> { return this.db.transaction(()=>work({token:this.db})); }
  async getCheckoutQuotes(ids:readonly string[]):Promise<CheckoutQuoteBatch> {
    ids.forEach(uuid);
    const rows=await this.commerce.listingRows(undefined, ids); const quotes:any[]=[],rejections:any[]=[];
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
    if (this.store) {
      const exists = this.store.stockReservations.find(r => r.orderItemId === orderItemId);
      if (!exists) {
        this.store.stockReservations.push({
          id: row.id,
          orderItemId,
          productId,
          quantity,
          status: 'HELD',
          expiresAt,
          createdAt: new Date().toISOString(),
        });
      }
    }
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
    if (!previous && agg.items.length > 0) {
      await this.db.query(
        'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE customer_id = $1) AND listing_id = ANY($2::uuid[])',
        [uuid(o.customerId), agg.items.map(i => uuid(i.listingId))],
      );
    }
    if (this.store) {
      const co = this.store.customerOrders.find(c => c.id === o.orderId);
      if (!co) {
        this.store.customerOrders.push({
          id: o.orderId,
          orderNo: o.orderNo,
          customerId: o.customerId,
          status: o.status,
          fulfillmentSummary: o.fulfillmentSummary,
          shippingAddress: (o as any).shippingAddress || { recipientName: 'Khách hàng', phone: '', address: '', city: '' },
          grandTotal: o.grandTotal,
          totalPayable: o.totalPayable,
          currency: 'VND',
          placedAt: o.createdAt,
          createdAt: o.createdAt,
          updatedAt: o.createdAt,
        });
      } else {
        co.status = o.status;
        co.fulfillmentSummary = o.fulfillmentSummary;
        co.totalPayable = o.totalPayable;
        co.updatedAt = new Date().toISOString();
      }
      for (const i of agg.items) {
        if (!this.store.orderItems.some(oi => oi.id === i.orderItemId)) {
          this.store.orderItems.push({
            id: i.orderItemId,
            customerOrderId: i.customerOrderId,
            listingId: i.listingId,
            productNameSnapshot: i.productName,
            quantity: i.quantity,
            unitSalePriceSnapshot: i.unitSalePrice,
            unitCostPriceSnapshot: i.unitCostPrice,
            createdAt: o.createdAt,
          });
        }
        if (!this.store.fulfillmentItems.some(fi => fi.orderItemId === i.orderItemId && fi.fulfillmentOrderId === i.fulfillmentOrderId)) {
          this.store.fulfillmentItems.push({
            id: randomUUID(),
            fulfillmentOrderId: i.fulfillmentOrderId,
            orderItemId: i.orderItemId,
            quantity: i.quantity,
            itemGrossSnapshot: i.lineSaleTotal,
          });
        }
      }
    }
  }
  async findById(id:string):Promise<OrderAggregate|null> {
    const [r]=await this.db.query('SELECT * FROM customer_orders WHERE id=$1',[uuid(id)]);
    if (!r) return null;
    if (r.snapshot) return r.snapshot;
    return this.reconstructSnapshot(r);
  }
  async findByCustomerId(id:string,p:PaginationQuery={}) {
    const page=p.page||1,limit=p.limit||20;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page-1)*limit) || (page-1)*limit > 2147483647) fail(400, 'INVALID_REQUEST');
    const [count]=await this.db.query('SELECT count(*)::int AS total FROM customer_orders WHERE customer_id=$1',[id]);
    const rows=await this.db.query('SELECT * FROM customer_orders WHERE customer_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',[id,limit,(page-1)*limit]);
    const items: OrderAggregate[] = [];
    for (const r of rows) {
      if (r.snapshot) {
        items.push(r.snapshot);
      } else {
        const reconstructed = await this.reconstructSnapshot(r);
        if (reconstructed) items.push(reconstructed);
      }
    }
    return {items,total:count.total,page,limit,totalPages:Math.max(1,Math.ceil(count.total/limit))};
  }
  private async reconstructSnapshot(r: any): Promise<OrderAggregate | null> {
    try {
      const orderId = r.id;
      const orderItems = await this.db.query('SELECT * FROM order_items WHERE customer_order_id=$1', [orderId]);
      const fos = await this.db.query('SELECT * FROM fulfillment_orders WHERE customer_order_id=$1', [orderId]);
      const payments = await this.db.query('SELECT * FROM payments WHERE customer_order_id=$1', [orderId]);
      const snapshot: OrderAggregate = {
        order: {
          orderId,
          orderNo: r.order_no,
          customerId: r.customer_id,
          status: r.status,
          fulfillmentSummary: r.fulfillment_summary,
          currency: r.currency || 'VND',
          grandTotal: Number(r.grand_total),
          totalPayable: Number(r.total_payable),
          createdAt: r.placed_at ? new Date(r.placed_at).toISOString() : new Date().toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
          itemsCount: orderItems.length,
          shippingAddress: { recipientName: 'Khách hàng', phone: '', address: '', city: '' },
        } as any,
        items: orderItems.map((oi: any, idx: number) => ({
          orderItemId: oi.id,
          customerOrderId: orderId,
          listingId: oi.listing_id,
          productId: oi.product_id || '',
          supplierId: fos[0]?.supplier_id || '',
          sellerId: fos[0]?.seller_id || '',
          productName: oi.product_name_snapshot,
          listingTitle: oi.product_name_snapshot,
          lineIndex: idx,
          quantity: oi.quantity,
          unitSalePrice: Number(oi.unit_sale_price_snapshot),
          unitCostPrice: Number(oi.unit_cost_price_snapshot),
          lineSaleTotal: Number(oi.unit_sale_price_snapshot) * oi.quantity,
          lineCostTotal: Number(oi.unit_cost_price_snapshot) * oi.quantity,
          fulfillmentOrderId: fos[0]?.id || '',
          reservationId: '',
          currency: 'VND' as const,
        })),
        fulfillmentOrders: fos.map((f: any) => ({
          fulfillmentOrderId: f.id,
          customerOrderId: orderId,
          supplierId: f.supplier_id,
          sellerId: f.seller_id,
          status: f.status,
          fulfillmentNo: f.fulfillment_no,
          amountToCollect: payments[0]?.amount ? Number(payments[0].amount) : 0,
          paymentAllocationId: '',
          orderItemIds: orderItems.map((oi: any) => oi.id),
          carrierCode: f.carrier_code || 'GHN_EXPRESS',
          trackingNo: f.tracking_no || undefined,
        })),
      };
      await this.db.query('UPDATE customer_orders SET snapshot=$1 WHERE id=$2', [snapshot, orderId]).catch(() => {});
      return snapshot;
    } catch {
      return null;
    }
  }
  async createInitialInCheckout(ctx:CheckoutTransactionContext,groups:readonly FulfillmentDraftGroup[]) {
    for(const g of groups) {
      await this.db.query("INSERT INTO fulfillment_orders(id,fulfillment_no,customer_order_id,supplier_id,seller_id,status) VALUES($1,$2,$3,$4,$5,'PENDING_ACCEPTANCE')",[g.fulfillmentOrderId,'FF-'+g.fulfillmentOrderId,g.customerOrderId,g.supplierId,g.sellerId]);
      if (this.store) {
        const exists = this.store.fulfillmentOrders.some(f => f.id === g.fulfillmentOrderId);
        if (!exists) {
          this.store.fulfillmentOrders.push({
            id: g.fulfillmentOrderId,
            fulfillmentNo: 'FF-' + g.fulfillmentOrderId,
            customerOrderId: g.customerOrderId,
            supplierId: g.supplierId,
            sellerId: g.sellerId,
            status: 'PENDING_ACCEPTANCE',
            trackingNo: null,
            carrierCode: 'GHN_EXPRESS',
            currency: 'VND',
            deliveryAttemptCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
  async createCheckoutObligation(ctx:CheckoutTransactionContext,id:string,method:PaymentMethod,allocations:readonly AllocationDraft[]) {
    const paymentId=randomUUID(),paymentIntentId=randomUUID(),allocationIds=allocations.map(()=>randomUUID());
    const total=allocations.reduce((n,a)=>n+a.amountToCollect,0),status=method==='COD'?'PENDING_COD':'PENDING';
    await this.db.query("INSERT INTO payment_intents(id,customer_order_id,provider,amount,status) VALUES($1,$2,'INTERNAL_OBLIGATION',$3,$4)",[paymentIntentId,id,total,status]);
    await this.db.query('INSERT INTO payments(id,customer_order_id,payment_intent_id,method,status,amount) VALUES($1,$2,$3,$4,$5,$6)',[paymentId,id,paymentIntentId,method,status,total]);
    for(let i=0;i<allocations.length;i++) {const a=allocations[i];await this.db.query('INSERT INTO payment_allocations(id,payment_id,fulfillment_order_id,merchandise_amount,shipping_amount,discount_amount,amount_to_collect) VALUES($1,$2,$3,$4,$5,$6,$7)',[allocationIds[i],paymentId,a.fulfillmentOrderId,a.merchandiseAmount,a.shippingAmount,a.discountAmount,a.amountToCollect]);}
    if (this.store) {
      this.store.payments.push({
        id: paymentId,
        customerOrderId: id,
        paymentIntentId,
        method: method === 'COD' ? 'COD' : 'ONLINE_MOCK',
        status,
        amount: total,
        providerTransactionRef: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      for (let i = 0; i < allocations.length; i++) {
        const a = allocations[i];
        this.store.paymentAllocations.push({
          id: allocationIds[i],
          paymentId,
          fulfillmentOrderId: a.fulfillmentOrderId,
          merchandiseAmount: a.merchandiseAmount,
          shippingAmount: a.shippingAmount,
          discountAmount: a.discountAmount,
          amountToCollect: a.amountToCollect,
          currency: 'VND',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
      }
    }
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
