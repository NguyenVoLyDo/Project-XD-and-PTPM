import { Inject, Injectable } from '@nestjs/common';
import { CommerceDb, fail, integer, money, nonempty, uuid } from './commerce-db';
import { CurrentActor } from '../../common/auth/current-actor.interface';
import { IdentityPort } from '../../modules/identity/application/ports/identity.port';

const productView = (p: any, cost = false) => ({ id: p.id, productId: p.id, supplierId: p.supplier_id,
  supplierSku: p.supplier_sku, name: p.name, description: p.description, imageUrl: p.image_url,
  status: p.status, availableStock: p.available_stock, ...(cost ? { costPrice: Number(p.cost_price) } : {}), currency: 'VND' });
@Injectable()
export class CommerceService {
  constructor(@Inject(CommerceDb) readonly db: CommerceDb, @Inject(IdentityPort) private readonly identity: IdentityPort) {}
  async profile(actor: CurrentActor, role: 'SUPPLIER' | 'SELLER') {
    if (actor.activeRole !== role || !actor.activeProfileId) fail(403, 'ACTIVE_ROLE_REQUIRED');
    if (!await this.identity.isProfileApproved(actor.activeProfileId)) fail(403, 'PROFILE_NOT_APPROVED');
    return actor.activeProfileId;
  }
  margin() { return integer(Number(process.env.MIN_MARGIN_VND || 0), 'MIN_MARGIN_VND'); }
  async productView(row: any, cost = false) {
    const stock = await this.stock(row.id);
    return { ...productView(row, cost), availableStock: stock.available };
  }
  async products(supplierId?: string, search?: string, actor?: CurrentActor) {
    const own = actor ? await this.profile(actor, 'SUPPLIER') : null;
    const rows = await this.db.query(`SELECT * FROM products WHERE ($1::uuid IS NULL OR supplier_id=$1)
      AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%') ${own ? '' : "AND status='ACTIVE'"} ORDER BY created_at DESC`, [own || (supplierId ? uuid(supplierId) : null), search || null]);
    return Promise.all(rows.map(row => this.productView(row, Boolean(own))));
  }
  async product(id: string) {
    const [row] = await this.db.query("SELECT * FROM products WHERE id=$1 AND status='ACTIVE'", [uuid(id)]);
    if (!row) fail(404, 'PRODUCT_NOT_FOUND');
    return this.productView(row);
  }
  async sourcing(actor: CurrentActor) {
    await this.profile(actor,'SELLER');
    const rows=await this.db.query("SELECT p.* FROM products p JOIN supplier_profiles s ON s.id=p.supplier_id JOIN users u ON u.id=s.user_id WHERE p.status='ACTIVE' AND s.approval_status='APPROVED' AND u.status='ACTIVE'");
    return Promise.all(rows.map(async p=>({...await this.productView(p,true),minimumSalePrice:Number(p.cost_price)+this.margin()})));
  }
  async createProduct(actor: CurrentActor, data: any, legacy = false) {
    const supplierId = await this.profile(actor, 'SUPPLIER');
    const sku = nonempty(data.supplierSku, 'supplierSku'), name = nonempty(data.name, 'name');
    const cost = money(data.costPrice, 'costPrice'), stock = integer(data.availableStock ?? 0, 'availableStock');
    if (stock > 2147483647) fail(400, 'VALIDATION_ERROR', 'availableStock exceeds PostgreSQL integer range');
    return this.db.transaction(async () => {
      if ((await this.db.query('SELECT id FROM products WHERE supplier_id=$1 AND supplier_sku=$2', [supplierId, sku])).length) fail(409, 'SUPPLIER_SKU_EXISTS');
      const [row] = await this.db.query(`INSERT INTO products(supplier_id,supplier_sku,name,description,cost_price,available_stock,status,image_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [supplierId, sku, name, data.description || '', cost, stock, legacy ? 'ACTIVE' : 'DRAFT', data.imageUrl || null]);
      await this.db.audit(actor.userId, 'PRODUCT_CREATED', 'PRODUCT', row.id);
      return productView(row, true);
    });
  }
  async ownedProduct(actor: CurrentActor, id: string) {
    const supplierId = await this.profile(actor, 'SUPPLIER');
    const [row] = await this.db.query('SELECT * FROM products WHERE id=$1', [uuid(id)]);
    if (!row) fail(404, 'PRODUCT_NOT_FOUND');
    if (row.supplier_id !== supplierId) fail(403, 'FORBIDDEN');
    return row;
  }
  async updateProduct(actor: CurrentActor, id: string, data: any) {
    return this.db.transaction(async () => {
      const p = await this.ownedProduct(actor, id);
      if (data.availableStock !== undefined) fail(400, 'USE_INVENTORY_ADJUSTMENT');
      if (data.status !== undefined && !['DRAFT', 'ACTIVE', 'INACTIVE'].includes(data.status)) fail(400, 'INVALID_STATUS');
      const cost = data.costPrice === undefined ? Number(p.cost_price) : money(data.costPrice, 'costPrice');
      const [updated] = await this.db.query('UPDATE products SET name=$2,description=$3,cost_price=$4,status=$5,updated_at=now() WHERE id=$1 RETURNING *', [id, data.name === undefined ? p.name : nonempty(data.name, 'name'), data.description ?? p.description, cost, data.status ?? p.status]);
      const paused = await this.db.query(`UPDATE listings SET status='PAUSED_BY_POLICY',visible=false,updated_at=now()
        WHERE product_id=$1 AND sale_price < $2 AND status='ACTIVE' RETURNING id,shop_id`, [id, cost + this.margin()]);
      for (const listing of paused) {
        const [seller] = await this.db.query('SELECT p.user_id FROM shops s JOIN seller_profiles p ON p.id=s.seller_id WHERE s.id=$1', [listing.shop_id]);
        await this.db.audit(actor.userId, 'LISTING_PAUSED_BY_POLICY', 'LISTING', listing.id);
        await this.db.event('ListingPausedByPolicy', listing.id, { listingId: listing.id, productId: id }, [seller.user_id]);
      }
      await this.db.audit(actor.userId, 'PRODUCT_UPDATED', 'PRODUCT', id);
      return this.productView(updated, true);
    });
  }
  async stock(id: string) {
    const [row] = await this.db.query(`SELECT p.available_stock AS "onHand", COALESCE(SUM(r.quantity) FILTER(WHERE r.status='HELD' AND r.expires_at>now()),0)::int AS reserved
      FROM products p LEFT JOIN stock_reservations r ON r.product_id=p.id WHERE p.id=$1 GROUP BY p.id`, [uuid(id)]);
    if (!row) fail(404, 'PRODUCT_NOT_FOUND');
    return { productId: id, ...row, available: row.onHand - row.reserved, totalStock: row.onHand, heldQuantity: row.reserved, availableForSale: row.onHand - row.reserved };
  }
  async adjust(actor: CurrentActor, data: any, absolute = false) {
    return this.db.transaction(async () => {
      const p = await this.ownedProduct(actor, data.productId);
      const state = await this.stock(p.id);
      const delta = absolute ? integer(data.availableStock, 'availableStock') - state.onHand : integer(data.delta, 'delta', -2147483648);
      const source = absolute ? null : nonempty(data.sourceRef, 'sourceRef');
      if (source) {
        const [old] = await this.db.query('SELECT * FROM inventory_adjustments WHERE product_id=$1 AND source_ref=$2', [p.id, source]);
        if (old) { if (old.delta !== delta || old.reason_code !== data.reasonCode) fail(409, 'STOCK_ADJUSTMENT_CONFLICT'); return old.result; }
      }
      const onHand = state.onHand + delta;
      if (!Number.isSafeInteger(onHand) || onHand < state.reserved || onHand > 2147483647) fail(409, 'STOCK_ADJUSTMENT_CONFLICT');
      await this.db.query('UPDATE products SET available_stock=$2,updated_at=now() WHERE id=$1', [p.id, onHand]);
      const result = { productId: p.id, onHand, reserved: state.reserved, available: onHand - state.reserved };
      if (source) {
        const [row] = await this.db.query('INSERT INTO inventory_adjustments(product_id,source_ref,delta,reason_code,result) VALUES($1,$2,$3,$4,$5) RETURNING id', [p.id, source, delta, nonempty(data.reasonCode, 'reasonCode'), result]);
        Object.assign(result, { adjustmentId: row.id });
        await this.db.query('UPDATE inventory_adjustments SET result=$2 WHERE id=$1', [row.id, result]);
      }
      await this.db.audit(actor.userId, 'STOCK_UPDATED', 'PRODUCT', p.id);
      return result;
    });
  }
  async shops(actor: CurrentActor) {
    const id = await this.profile(actor, 'SELLER');
    return this.db.query('SELECT id,id AS "shopId",name,status,seller_id AS "sellerId" FROM shops WHERE seller_id=$1 ORDER BY created_at', [id]);
  }
  async createShop(actor: CurrentActor, data: any, legacy = false) {
    const id = await this.profile(actor, 'SELLER');
    return this.db.transaction(async () => {
      const [row] = await this.db.query('INSERT INTO shops(seller_id,name,status) VALUES($1,$2,$3) RETURNING id,id AS "shopId",name,status', [id, nonempty(data.name, 'name'), legacy ? 'ACTIVE' : 'DRAFT']);
      await this.db.audit(actor.userId, 'SHOP_CREATED', 'SHOP', row.id);
      return row;
    });
  }
  async ownedShop(actor: CurrentActor, id: string) {
    const sellerId = await this.profile(actor, 'SELLER');
    const [shop] = await this.db.query('SELECT * FROM shops WHERE id=$1', [uuid(id)]);
    if (!shop) fail(404, 'SHOP_NOT_FOUND');
    if (shop.seller_id !== sellerId) fail(403, 'FORBIDDEN');
    return shop;
  }
  async updateShop(actor: CurrentActor, id: string, data: any) {
    return this.db.transaction(async () => {
      const shop = await this.ownedShop(actor, id);
      if (data.status && !['DRAFT','ACTIVE','SUSPENDED'].includes(data.status)) fail(400, 'INVALID_STATUS');
      const [row] = await this.db.query('UPDATE shops SET name=$2,status=$3,updated_at=now() WHERE id=$1 RETURNING id,name,status', [id, data.name === undefined ? shop.name : nonempty(data.name,'name'), data.status || shop.status]);
      await this.db.audit(actor.userId,'SHOP_UPDATED','SHOP',id); return row;
    });
  }
  async listingRows(id?: string) {
    return this.db.query(`SELECT l.*,p.name AS product_name,p.description,p.image_url,p.cost_price,p.available_stock,
      p.status AS product_status,p.supplier_id,s.seller_id,s.name AS shop_name,s.status AS shop_status,
      sp.approval_status AS supplier_status,sl.approval_status AS seller_status,sp.legal_name,sl.display_name,
      su.status AS supplier_user_status,se.status AS seller_user_status
      FROM listings l JOIN products p ON p.id=l.product_id JOIN shops s ON s.id=l.shop_id
      JOIN supplier_profiles sp ON sp.id=p.supplier_id JOIN seller_profiles sl ON sl.id=s.seller_id
      JOIN users su ON su.id=sp.user_id JOIN users se ON se.id=sl.user_id WHERE ($1::uuid IS NULL OR l.id=$1) ORDER BY l.created_at`, [id ? uuid(id) : null]);
  }
  eligible(r: any) { return r.status === 'ACTIVE' && r.visible && r.product_status === 'ACTIVE' && r.shop_status === 'ACTIVE' && r.supplier_status === 'APPROVED' && r.seller_status === 'APPROVED' && r.supplier_user_status === 'ACTIVE' && r.seller_user_status === 'ACTIVE' && Number(r.sale_price) >= Number(r.cost_price) + this.margin(); }
  async listingView(r: any) {
    const stock = await this.stock(r.product_id);
    return { id:r.id,listingId:r.id,productId:r.product_id,shopId:r.shop_id,sellerId:r.seller_id,supplierId:r.supplier_id,
      sellerSku:r.seller_sku || '',title:r.product_name,productName:r.product_name,productDescription:r.description,
      productImage:r.image_url,shopName:r.shop_name,supplierName:r.legal_name,sellerName:r.display_name,
      salePrice:Number(r.sale_price),currency:'VND',status:r.status,visible:r.visible,canPurchase:this.eligible(r) && stock.available>0,availableStock:stock.available };
  }
  async listings(shopId?: string, search?: string, actor?: CurrentActor, id?: string) {
    const sellerId = actor ? await this.profile(actor, 'SELLER') : null;
    const rows = (await this.listingRows(id)).filter(r => (!sellerId ? this.eligible(r) : r.seller_id === sellerId) && (!shopId || r.shop_id === uuid(shopId)) && (!id || r.id === uuid(id)) && (!search || (r.product_name+' '+r.shop_name).toLowerCase().includes(search.toLowerCase())));
    if (id && !rows.length) fail(404,'LISTING_NOT_FOUND');
    const views = await Promise.all(rows.map(async r => ({...await this.listingView(r),...(sellerId?{costPrice:Number(r.cost_price),minimumSalePrice:Number(r.cost_price)+this.margin()}:{})}))); return id ? views[0] : views;
  }
  async createListing(actor: CurrentActor, data: any, legacy = false) {
    return this.db.transaction(async () => {
      const shop = await this.ownedShop(actor,data.shopId);
      if (shop.status !== 'ACTIVE') fail(409,'SHOP_INACTIVE');
      const [p] = await this.db.query("SELECT * FROM products WHERE id=$1 AND status='ACTIVE'",[uuid(data.productId)]);
      if (!p) fail(404,'PRODUCT_NOT_FOUND');
      const price = money(data.salePrice,'salePrice');
      if (price < Number(p.cost_price)+this.margin()) fail(409,'MIN_MARGIN_VIOLATION');
      if (data.sellerSku && (await this.db.query('SELECT id FROM listings WHERE shop_id=$1 AND seller_sku=$2',[shop.id,data.sellerSku])).length) fail(409,'SELLER_SKU_EXISTS');
      const [l] = await this.db.query('INSERT INTO listings(product_id,shop_id,seller_sku,sale_price,status,visible) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[p.id,shop.id,data.sellerSku || null,price,legacy?'ACTIVE':'DRAFT',legacy]);
      await this.db.audit(actor.userId,'LISTING_CREATED','LISTING',l.id);
      return (await this.listings(undefined,undefined,actor) as any[]).find(r=>r.id===l.id);
    });
  }
  async updateListing(actor: CurrentActor, id: string, data: any, publish = false) {
    id = uuid(id);
    return this.db.transaction(async () => {
      const [l] = await this.db.query('SELECT * FROM listings WHERE id=$1',[uuid(id)]);
      if (!l) fail(404,'LISTING_NOT_FOUND');
      const shop = await this.ownedShop(actor,l.shop_id);
      const [p] = await this.db.query('SELECT * FROM products WHERE id=$1',[l.product_id]);
      const price = data.salePrice === undefined ? Number(l.sale_price) : money(data.salePrice,'salePrice');
      if (price < Number(p.cost_price)+this.margin()) fail(409,'MIN_MARGIN_VIOLATION');
      if (data.status && !['DRAFT','ACTIVE','INACTIVE'].includes(data.status)) fail(400,'INVALID_STATUS');
      const active = publish || data.status === 'ACTIVE' || (data.status === undefined && data.salePrice !== undefined && l.status === 'PAUSED_BY_POLICY');
      if (active && (shop.status !== 'ACTIVE' || p.status !== 'ACTIVE' || !await this.identity.isProfileApproved(p.supplier_id))) fail(409,'LISTING_UNAVAILABLE');
      await this.db.query('UPDATE listings SET sale_price=$2,status=$3,visible=$4,updated_at=now() WHERE id=$1',[id,price,active?'ACTIVE':data.status || l.status,active?true:data.visible ?? l.visible]);
      await this.db.audit(actor.userId,'LISTING_UPDATED','LISTING',id);
      return (await this.listings(undefined,undefined,actor) as any[]).find(r=>r.id===id);
    });
  }
}
