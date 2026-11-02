// pnpm test:postgres; pnpm test:browser adds desktop/mobile Chromium checks.
// PG_TEST_BIN may point to a PostgreSQL bin directory (initdb, pg_ctl and extensions).
// Disposable PostgreSQL cluster; never reads backend/.env or touches the project DB.
require('reflect-metadata');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const root = path.resolve(__dirname, '../../..');
const bin = process.env.PG_TEST_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/13/bin' : '');
const exe = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const run = (name, args) => execFileSync(exe(name), args, { windowsHide: true, stdio: 'ignore', timeout: 60000 });

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropconnect-pg-test-'));
  const data = path.join(dir, 'data');
  let started = false, app, client;
  const uploaded = [];
  try {
    const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
    run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
    run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    const url = `postgres://postgres@127.0.0.1:${port}/dropconnect_test`;
    client = new Client({ connectionString: url.replace('/dropconnect_test', '/postgres') });
    await client.connect();
    await client.query('CREATE DATABASE dropconnect_test');
    await client.end();
    client = new Client({ connectionString: url }); await client.connect();
    // Skip init.sql's administrator/reset preamble; apply only table DDL in our new DB.
    let schema = fs.readFileSync(path.join(root, 'backend/database/init.sql'), 'utf8');
    schema = schema.slice(schema.indexOf('CREATE EXTENSION'));
    schema = schema.replace(/^\\ir (.+)$/gm, (_, relative) => fs.readFileSync(path.join(root, 'backend/database', relative.trim()), 'utf8'));
    await client.query(schema);
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SSL = 'false';
    process.env.JWT_SECRET = 'isolated-regression-secret';
    process.env.DEMO_AUTH_ENABLED = 'false';
    process.env.NODE_ENV = 'test';
    const { NestFactory } = require('@nestjs/core');
    const { ValidationPipe } = require('@nestjs/common');
    const { AppModule } = require('../../dist/app.module');
    const { HttpExceptionFilter } = require('../../dist/common/errors/http-exception.filter');
    const { ResponseTransformInterceptor } = require('../../dist/common/http/response.interceptor');
    app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
    app.use(require('cookie-parser')());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();
    const http = request(app.getHttpServer());
    const call = async (method, route, token, body, expected = 200, headers = {}) => {
      let req = http[method]('/api/v1' + route).set(headers);
      if (token) req = req.auth(token, { type: 'bearer' });
      if (body !== undefined) req = req.send(body);
      const res = await req;
      assert.equal(res.status, expected, `${method} ${route}: ${JSON.stringify(res.body)}`);
      return res.body.data;
    };
    async function account(role) {
      const email = randomUUID() + '@example.test', password = 'Password123!';
      const user = await call('post', '/auth/register', null, { email, password, role }, 201);
      let profile;
      if (role !== 'CUSTOMER') {
        const table = role === 'SUPPLIER' ? 'supplier_profiles' : 'seller_profiles';
        profile = (await client.query(`UPDATE ${table} SET approval_status='APPROVED' WHERE user_id=$1 RETURNING id`, [user.userId])).rows[0].id;
      }
      const login = await http.post('/api/v1/auth/login').send({ email, password });
      assert.equal(login.status, 200);
      let token = login.body.data.accessToken;
      if (role !== 'CUSTOMER') token = (await call('post', '/me/active-role', token, { role })).accessToken;
      return { token, userId: user.userId, profile, cookie: login.headers['set-cookie'][0].split(';')[0] };
    }
    const supplier = await account('SUPPLIER'), seller = await account('SELLER');
    const png = await require('sharp')({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
    const upload = await http.post('/api/v1/uploads').auth(supplier.token,{type:'bearer'}).attach('file',png,{filename:'fake.html',contentType:'image/png'});
    assert.equal(upload.status,201); assert.equal(upload.body.data.mimetype,'image/webp');
    uploaded.push(path.join(root,'backend/uploads',upload.body.data.filename));
    for (const [bytes,name,type] of [[Buffer.from('<html>fake</html>'),'fake.png','image/png'],[Buffer.from('<svg/>'),'fake.svg','image/svg+xml'],[Buffer.alloc(10*1024*1024+1),'big.png','image/png']]) {
      const rejected = await http.post('/api/v1/uploads').auth(supplier.token,{type:'bearer'}).attach('file',bytes,{filename:name,contentType:type});
      assert.ok([400,413].includes(rejected.status));
    }
    console.log('PASS: HTTP upload decoding, SVG rejection and file-size limit');
    const a = await account('CUSTOMER'), b = await account('CUSTOMER');
    const p = await call('post', '/catalog/products', supplier.token, { supplierSku: 'TEST', name: 'Điện thoại kiểm thử', costPrice: 100, availableStock: 100 }, 201);
    const shop = await call('post', '/listings/seller/shops', seller.token, { name: 'Shop test' }, 201);
    const l = await call('post', '/listings', seller.token, { productId: p.id, shopId: shop.id, salePrice: 200 }, 201);
    const add = (actor, quantity) => call('put', `/cart/items/${l.id}`, actor.token, { quantity });
    const body = cart => ({ cartId: cart.cartId, paymentMethod: 'COD', shippingAddress: { recipientName: 'Test', phone: '0901234567', line1: 'Test street', wardCode: '001', provinceCode: '01' } });
    const checkout = (actor, payload, key) => http.post('/api/v1/checkout').auth(actor.token, { type: 'bearer' }).set('Idempotency-Key', key).send(payload);
    const payload = body(await add(a, 20)), key = randomUUID();
    const replay = await Promise.all([checkout(a, payload, key), checkout(a, payload, key)]);
    replay.forEach(r => assert.equal(r.status, 201, JSON.stringify(r.body)));
    assert.equal(replay[0].body.data.orderId, replay[1].body.data.orderId);
    const own = await call('get', '/supplier/products', supplier.token);
    assert.equal(own[0].onHand, 100); assert.equal(own[0].reserved, 20); assert.equal(own[0].available, 80);
    const adjustment = { productId: p.id, delta: 0, expectedOnHand: 100, sourceRef: randomUUID(), reasonCode: 'MANUAL' };
    await call('post', '/supplier/inventory/adjustments', supplier.token, adjustment, 201);
    const increment = { ...adjustment, delta: 5, sourceRef: randomUUID() };
    const inc = await call('post', '/supplier/inventory/adjustments', supplier.token, increment, 201);
    assert.deepEqual(await call('post', '/supplier/inventory/adjustments', supplier.token, increment, 201), inc);
    await call('post', '/supplier/inventory/adjustments', supplier.token, { ...adjustment, sourceRef: randomUUID() }, 409);
    await call('post', '/supplier/inventory/adjustments', supplier.token, { ...adjustment, delta: -90, expectedOnHand: 105, sourceRef: randomUUID() }, 409);
    await call('post', '/supplier/inventory/adjustments', seller.token, adjustment, 403);
    console.log('PASS: PostgreSQL idempotency, stock totals, retries, stale edits, ownership');
    // Leave exactly one unit available, then race two different customer checkouts.
    await call('patch', `/inventory/product/${p.id}`, supplier.token, { availableStock: 21 });
    const pa = body(await add(a, 1)), pb = body(await add(b, 1));
    const race = await Promise.all([checkout(a, pa, randomUUID()), checkout(b, pb, randomUUID())]);
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
    assert.equal((await call('get', `/supplier/inventory/products/${p.id}`, supplier.token)).available, 0);
    console.log('PASS: competing PostgreSQL checkouts cannot oversell');
    // Force failure late in checkout; all normalized records must roll back.
    await call('patch', `/inventory/product/${p.id}`, supplier.token, { availableStock: 50 });
    const c = await account('CUSTOMER'), rollbackBody = body(await add(c, 1));
    const counts = async () => {
      const result = {};
      for (const table of ['customer_orders','order_items','fulfillment_orders','payments','payment_intents','payment_allocations','stock_reservations','idempotency_keys','outbox_events']) result[table] = Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
      return result;
    };
    const before = await counts();
    await client.query("CREATE FUNCTION reject_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intentional regression failure'; END $$; CREATE TRIGGER reject_test_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_test_outbox()");
    assert.equal((await checkout(c, rollbackBody, randomUUID())).status, 500);
    assert.deepEqual(await counts(), before);
    await client.query('DROP TRIGGER reject_test_outbox ON outbox_events; DROP FUNCTION reject_test_outbox()');
    assert.equal((await call('get', '/cart', c.token)).items.length, 1);
    console.log('PASS: late PostgreSQL failure rolls back order/payment/reservation/outbox');
    const page = await call('get', '/listings/page?limit=1&search=dien%20thoai&sort=price-desc');
    assert.equal(page.total, 1); assert.equal(page.items[0].id, l.id);
    assert.equal(page.suppliers[0].id, supplier.profile);
    await call('get', '/listings/page?limit=101', null, undefined, 400);
    assert.equal((await call('get', '/listings/page?search=%25')).total, 0);
    // Query count is constant regardless of matching row count.
    const { CommerceDb } = require('../../dist/integration/postgres/commerce-db');
    const db = app.get(CommerceDb), query = db.query.bind(db);
    let queries = 0; db.query = (...args) => { queries++; return query(...args); };
    await call('get', '/listings/page');
    assert.equal(queries, 3); db.query = query;
    console.log('PASS: SQL pagination/filtering and constant query count');
    // Real session rotation then logout; rotated credentials cannot refresh again.
    const rotated = await http.post('/api/v1/auth/refresh').set('Cookie', c.cookie);
    assert.equal(rotated.status, 200);
    const cookie = rotated.headers['set-cookie'][0].split(';')[0];
    const logout = await http.post('/api/v1/auth/logout').auth(rotated.body.data.accessToken,{type:'bearer'}).set('Cookie',cookie);
    assert.equal(logout.status, 204);
    assert.equal((await http.post('/api/v1/auth/refresh').set('Cookie',cookie)).status, 401);
    console.log('PASS: rotated session revoked on logout');
    if (process.env.REVIEW_BROWSER === 'true' || process.argv.includes('--browser')) {
      await require('./review-browser.cjs')({ app, accounts: { supplier, a }, product: p, root });
    }
  } finally {
    if (app) await app.close();
    for (const filename of uploaded) fs.unlinkSync(filename);
    if (client) await client.end().catch(() => {});
    if (started && fs.existsSync(path.join(data, 'postmaster.pid'))) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    // Only the unique directory created by this invocation may be removed.
    if (path.dirname(dir) === path.resolve(os.tmpdir()) && path.basename(dir).startsWith('dropconnect-pg-test-')) fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
