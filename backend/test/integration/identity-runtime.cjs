// Compiled Nest module wiring + real JWT/HTTP; repositories are test doubles, not PostgreSQL.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { DataSource } = require('typeorm');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const { AppModule } = require('../../dist/app.module');
const { PasswordHasherService } = require('../../dist/modules/identity/infrastructure/password-hasher.service');
const { HttpExceptionFilter } = require('../../dist/common/errors/http-exception.filter');
const { ResponseTransformInterceptor } = require('../../dist/common/http/response.interceptor');
const { StoreService } = require('../../dist/common/database/store.service');

(async () => {
  process.env.DEMO_AUTH_ENABLED = 'false';
  const repositories = new Map();
  const repo = target => {
    const name = typeof target === 'string' ? target : target.name;
    if (!repositories.has(name)) {
      const rows = [];
      const matches = (row, where) => Object.entries(where || {}).every(([k, v]) => row[k] === v);
      repositories.set(name, {
        rows, create: value => ({ ...value }),
        save: async value => { if (!value.id) value.id = randomUUID(); if (!rows.includes(value)) rows.push(value); return value; },
        findOne: async ({ where }) => rows.find(row => matches(row, where)) || null,
        find: async () => rows,
        update: async (where, values) => { rows.filter(row => matches(row, where)).forEach(row => Object.assign(row, values)); return { affected: 1 }; },
      });
    }
    return repositories.get(name);
  };
  const dataSource = { options: { type: 'postgres' }, entityMetadatas: [], getRepository: repo, isInitialized: false };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DataSource).useValue(dataSource).compile();
  const app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  try {
    await app.init();
    const user = { id: randomUUID(), email: 'integration@example.test', status: 'ACTIVE', passwordHash: await app.get(PasswordHasherService).hash('TestPassword123!'), roleMemberships: [{ role: 'CUSTOMER', status: 'ACTIVE' }] };
    repo('User').rows.push(user);
    repo('UserRoleMembership').rows.push({ userId: user.id, role: 'CUSTOMER', status: 'ACTIVE' });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: user.email, password: 'TestPassword123!' });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.data.accessToken;
    assert.ok(token);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await request(app.getHttpServer()).get('/api/v1/me').set(auth);
    assert.equal(me.status, 200, JSON.stringify(me.body));
    assert.equal(me.body.data.userId, user.id);
    const cart = await request(app.getHttpServer()).get('/api/v1/cart').set(auth);
    assert.equal(cart.status, 200, JSON.stringify(cart.body));
    const listing = app.get(StoreService).listings[0];
    const added = await request(app.getHttpServer()).put(`/api/v1/cart/items/${listing.id}`).set(auth).send({ quantity: 1 });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    const order = await request(app.getHttpServer()).post('/api/v1/checkout').set(auth).set('Idempotency-Key', randomUUID()).send({
      cartId: added.body.data.cartId, paymentMethod: 'COD',
      shippingAddress: { recipientName: 'Integration User', phone: '0901234567', line1: 'Test Street', wardCode: '001', provinceCode: '01' },
    });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal((await request(app.getHttpServer()).get('/api/v1/admin/users').set(auth)).status, 403);
    assert.equal((await request(app.getHttpServer()).get('/api/v1/cart').set({ 'x-user-id': 'u-customer-c', 'x-role': 'CUSTOMER' })).status, 401);
    user.status = 'LOCKED';
    const locked = await request(app.getHttpServer()).get('/api/v1/cart').set(auth);
    assert.equal(locked.status, 403, JSON.stringify(locked.body));
    assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');
    assert.ok(repo('UserSession').rows.every(session => session.isRevoked));
    console.log('PASS: integrated login, JWT -> me/cart/checkout, RBAC, forged headers, lock between requests (repository doubles).');
    if (process.argv.includes('--audit')) {
      await require('./flow-audit.cjs')({ app, repo, user });
    }
    if (process.argv.includes('--browser')) {
      user.status = 'ACTIVE';
      const path = require('node:path');
      const fs = require('node:fs');
      const http = require('node:http');
      const { chromium, expect } = require('@playwright/test');
      const root = path.resolve(__dirname, '../../..');
      const next = require(path.join(root, 'frontend/node_modules/next'));
      let frontend, server, browser;
      try {
        await app.listen(0, '127.0.0.1');
        const apiUrl = await app.getUrl();
        frontend = next({ dev: false, dir: path.join(root, 'frontend') });
        await frontend.prepare();
        server = http.createServer(frontend.getRequestHandler());
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const executablePath = [chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
        browser = await chromium.launch({ headless: true, executablePath });
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://localhost:4000/api/v1/**', async route => {
          const url = new URL(route.request().url());
          const response = await route.fetch({ url: apiUrl + url.pathname + url.search });
          await route.fulfill({ response });
        });
        await page.goto(base + '/admin');
        await page.waitForURL(/\/login/);
        await page.locator('#login-email-input').fill(user.email);
        await page.locator('#login-password-input').fill('TestPassword123!');
        await page.locator('#login-form button[type="submit"]').click();
        await page.waitForURL(base + '/');
        await expect(page.locator('header')).toContainText(user.email);
        await expect(page.locator('#demo-account')).toHaveCount(0);
        await page.goto(base + '/cart');
        await expect(page.locator('header')).toContainText(user.email);
        await page.goto(base + '/admin');
        await expect(page.getByRole('alert').filter({ hasText: 'Cần vai trò' })).toContainText('quản trị viên');
        assert.deepEqual(errors, []);
        console.log('PASS: Chromium mobile login, session reload, real actor navbar, customer denied Admin, no page errors.');
      } finally {
        await browser?.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await frontend?.close();
      }
    }
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
