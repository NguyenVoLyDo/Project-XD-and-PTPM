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
  async productView(row: any, cost = false, knownStock?: {onHand: number; reserved: number; available: number}) {
    const stock = knownStock || await this.stock(row.id);
    return { ...productView(row, cost), availableStock: stock.available, onHand: stock.onHand, reserved: stock.reserved, available: stock.available };
  }
  private async productViews(rows: any[], cost = false) {
    if (!rows.length) return [];
    const held = await this.db.query("SELECT product_id,SUM(quantity)::int AS reserved FROM stock_reservations WHERE product_id=ANY($1::uuid[]) AND status='HELD' AND expires_at>now() GROUP BY product_id", [rows.map(r => r.id)]);
    const reservations = new Map(held.map(r => [r.product_id, r.reserved]));
    return Promise.all(rows.map(r => {
      const onHand = Number(r.available_stock), reserved = Number(reservations.get(r.id) || 0);
      return this.productView(r, cost, { onHand, reserved, available: onHand - reserved });
    }));
  }
  async products(supplierId?: string, search?: string, actor?: CurrentActor) {
    const own = actor ? await this.profile(actor, 'SUPPLIER') : null;
    const rows = await this.db.query(`SELECT * FROM products WHERE ($1::uuid IS NULL OR supplier_id=$1)
      AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%') ${own ? '' : "AND status='ACTIVE'"} ORDER BY created_at DESC`, [own || (supplierId ? uuid(supplierId) : null), search || null]);
    return this.productViews(rows, Boolean(own));
  }
  async product(id: string) {
    const [row] = await this.db.query("SELECT * FROM products WHERE id=$1 AND status='ACTIVE'", [uuid(id)]);
    if (!row) fail(404, 'PRODUCT_NOT_FOUND');
    return this.productView(row);
  }
  async sourcing(actor: CurrentActor) {
    await this.profile(actor,'SELLER');
    const rows=await this.db.query("SELECT p.* FROM products p JOIN supplier_profiles s ON s.id=p.supplier_id JOIN users u ON u.id=s.user_id WHERE p.status='ACTIVE' AND s.approval_status='APPROVED' AND u.status='ACTIVE'");
    return (await this.productViews(rows, true)).map(p => ({ ...p, minimumSalePrice: p.costPrice + this.margin() }));
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
      if (data.expectedOnHand !== undefined && integer(data.expectedOnHand, 'expectedOnHand') !== state.onHand) {
        fail(409, 'STOCK_ADJUSTMENT_CONFLICT', 'Tồn kho đã thay đổi. Vui lòng tải lại trước khi điều chỉnh.');
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
  private listingQuery(filters: { id?: string; ids?: readonly string[]; shopId?: string; sellerId?: string; supplierId?: string; search?: string; publicOnly?: boolean } = {}) {
    const params: any[] = [];
    const clauses: string[] = [];
    const add = (sql: string, value: any) => { params.push(value); clauses.push(sql.replace('?', `$${params.length}`)); };
    if (filters.id) add('l.id=?', uuid(filters.id));
    if (filters.ids) add('l.id=ANY(?::uuid[])', filters.ids.map(uuid));
    if (filters.shopId) add('l.shop_id=?', uuid(filters.shopId));
    if (filters.sellerId) add('s.seller_id=?', uuid(filters.sellerId));
    if (filters.supplierId) add('p.supplier_id=?', uuid(filters.supplierId));
    if (filters.search) {
      // Match the storefront's Vietnamese accent-insensitive search without an extension.
      const accents = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
      const plain = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
      add(`translate(lower(p.name || ' ' || s.name), '${accents + accents.toUpperCase()}', '${plain + plain}') LIKE ? ESCAPE '\\'`, '%' + filters.search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[\\%_]/g, '\\$&') + '%');
    }
    if (filters.publicOnly) {
      clauses.push("l.status='ACTIVE' AND l.visible AND p.status='ACTIVE' AND s.status='ACTIVE' AND sp.approval_status='APPROVED' AND sl.approval_status='APPROVED' AND su.status='ACTIVE' AND se.status='ACTIVE'");
      add('l.sale_price >= p.cost_price + ?', this.margin());
    }
    const sql = `SELECT l.*,p.name AS product_name,p.description,p.image_url,p.cost_price,p.available_stock,
      COALESCE(held.quantity,0)::int AS reserved,
      p.status AS product_status,p.supplier_id,s.seller_id,s.name AS shop_name,s.status AS shop_status,
      sp.approval_status AS supplier_status,sl.approval_status AS seller_status,sp.legal_name,sl.display_name,
      su.status AS supplier_user_status,se.status AS seller_user_status
      FROM listings l JOIN products p ON p.id=l.product_id JOIN shops s ON s.id=l.shop_id
      JOIN supplier_profiles sp ON sp.id=p.supplier_id JOIN seller_profiles sl ON sl.id=s.seller_id
      JOIN users su ON su.id=sp.user_id JOIN users se ON se.id=sl.user_id
      LEFT JOIN (SELECT product_id,SUM(quantity) AS quantity FROM stock_reservations WHERE status='HELD' AND expires_at>now() GROUP BY product_id) held ON held.product_id=p.id
      WHERE ${clauses.length ? clauses.join(' AND ') : 'true'}`;
    return { sql, params };
  }
  async listingRows(id?: string, ids?: readonly string[]) {
    const { sql, params } = this.listingQuery({ id, ids });
    return this.db.query(sql + ' ORDER BY l.created_at,l.id', params);
  }
  async listingPage(query: { page?: string; limit?: string; supplierId?: string; search?: string; sort?: string }) {
    for (const key of ['page', 'limit', 'supplierId', 'search', 'sort']) {
      if (query[key] !== undefined && typeof query[key] !== 'string') fail(400, 'INVALID_QUERY');
    }
    const page = integer(Number(query.page ?? 1), 'page', 1);
    const limit = integer(Number(query.limit ?? 24), 'limit', 1);
    if (limit > 100 || (page - 1) * limit > 2147483647) fail(400, 'INVALID_PAGINATION');
    if (query.sort && !['price-asc', 'price-desc'].includes(query.sort)) fail(400, 'INVALID_SORT');
    const { sql, params } = this.listingQuery({ publicOnly: true, supplierId: query.supplierId, search: query.search });
    const order = query.sort === 'price-asc' ? 'sale_price ASC,id' : query.sort === 'price-desc' ? 'sale_price DESC,id' : 'created_at,id';
    const rows = await this.db.query(`SELECT * FROM (${sql}) listing_page ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
    const [count] = await this.db.query(`SELECT count(*)::int AS total FROM (${sql}) listing_count`, params);
    const facets = this.listingQuery({ publicOnly: true });
    const suppliers = await this.db.query(`SELECT DISTINCT supplier_id AS id,legal_name AS name FROM (${facets.sql}) supplier_options ORDER BY name,id`, facets.params);
    return { items: await Promise.all(rows.map(r => this.listingView(r))), total: count.total, page, limit, totalPages: Math.max(1, Math.ceil(count.total / limit)), suppliers };
  }
  eligible(r: any) { return r.status === 'ACTIVE' && r.visible && r.product_status === 'ACTIVE' && r.shop_status === 'ACTIVE' && r.supplier_status === 'APPROVED' && r.seller_status === 'APPROVED' && r.supplier_user_status === 'ACTIVE' && r.seller_user_status === 'ACTIVE' && Number(r.sale_price) >= Number(r.cost_price) + this.margin(); }
  async listingView(r: any) {
    const stock = { available: Number(r.available_stock) - Number(r.reserved) };
    return { id:r.id,listingId:r.id,productId:r.product_id,shopId:r.shop_id,sellerId:r.seller_id,supplierId:r.supplier_id,
      sellerSku:r.seller_sku || '',title:r.product_name,productName:r.product_name,productDescription:r.description,
      productImage:r.image_url,shopName:r.shop_name,supplierName:r.legal_name,sellerName:r.display_name,
      salePrice:Number(r.sale_price),currency:'VND',status:r.status,visible:r.visible,canPurchase:this.eligible(r) && stock.available>0,availableStock:stock.available };
  }
  async listings(shopId?: string, search?: string, actor?: CurrentActor, id?: string) {
    const sellerId = actor ? await this.profile(actor, 'SELLER') : null;
    const { sql, params } = this.listingQuery({ id, shopId, search, sellerId, publicOnly: !sellerId });
    const rows = await this.db.query(sql + ' ORDER BY l.created_at,l.id', params);
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
