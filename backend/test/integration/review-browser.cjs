const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { JwtService } = require('@nestjs/jwt');
const { DataSource } = require('typeorm');

module.exports = async ({ app, accounts, product, root }) => {
  let frontend, server, browser;
  const screenshots = path.join(root, 'test-results/code-review');
  fs.mkdirSync(screenshots, { recursive: true });
  try {
    await app.listen(0, '127.0.0.1');
    const apiUrl = await app.getUrl();
    frontend = require(path.join(root, 'frontend/node_modules/next'))({ dev: false, dir: path.join(root, 'frontend') });
    await frontend.prepare();
    server = http.createServer(frontend.getRequestHandler());
    await new Promise(resolve => server.listen(0, resolve));
    const base = 'http://localhost:' + server.address().port;
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    await context.route('http://localhost:4000/api/v1/**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,content-type,idempotency-key' } });
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: apiUrl + url.pathname + url.search });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } });
    });
    const page = await context.newPage();
    await page.goto(base);
    const supplier = accounts.supplier;
    await page.evaluate(token => {
      localStorage.setItem('dc_access_token', token);
      localStorage.setItem('dc_has_session', 'true');
      localStorage.setItem('dc_session_generation', 'regression-session');
    }, supplier.token);
    await context.addCookies([{ name: 'refreshToken', value: supplier.cookie.split('=')[1], domain: 'localhost', path: '/api/v1/auth', httpOnly: true, sameSite: 'Lax' }]);
    await page.goto(base + '/supplier/products');
    await page.getByRole('button', { name: 'Sửa tồn', exact: true }).click();
    await expect(page.locator('#stock-stepper-input')).toHaveValue('50');
    await page.locator('#stock-stepper-input').fill('1');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'không thấp hơn' })).toBeVisible();
    await page.locator('#stock-stepper-input').fill('50');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.locator('#stock-stepper-input')).toHaveCount(0);
    const ds = app.get(DataSource);
    assert.equal((await ds.query('SELECT available_stock FROM products WHERE id=$1',[product.id]))[0].available_stock, 50);
    await page.screenshot({ path: path.join(screenshots, 'supplier-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Sửa tồn', exact: true }).click();
    await page.screenshot({ path: path.join(screenshots, 'stock-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    console.log('PASS: desktop/mobile stock editor preserves on-hand and validates held stock');
    // Add enough rows to exercise actual SQL pagination through the storefront.
    await ds.query("INSERT INTO listings(product_id,shop_id,sale_price,status,visible) SELECT product_id,shop_id,200+n,'ACTIVE',true FROM listings CROSS JOIN generate_series(1,25) n LIMIT 25");
    await page.goto(base + '/catalog');
    await expect(page.locator('.product-card')).toHaveCount(24);
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(2);
    await page.locator('#catalog-search').fill('dien thoai');
    await expect(page.locator('.product-card')).toHaveCount(24);
    await page.screenshot({ path: path.join(screenshots, 'catalog-mobile.png'), fullPage: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log('PASS: storefront SQL pagination and Vietnamese search');
    // Expire only the access JWT; leave the refresh cookie/session valid.
    await page.setViewportSize({ width: 1440, height: 1000 });
    const jwt = app.get(JwtService), payload = jwt.decode(supplier.token);
    delete payload.iat; delete payload.exp;
    const expired = jwt.sign(payload, { expiresIn: -1 });
    await page.evaluate(token => localStorage.setItem('dc_access_token', token), expired);
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('dc_access_token'))).toBe(null);
    assert.equal(Number((await ds.query('SELECT count(*) AS n FROM user_sessions WHERE user_id=$1 AND NOT is_revoked',[supplier.userId]))[0].n), 0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toHaveCount(0);
    assert.equal((await context.cookies('http://localhost:4000/api/v1/auth')).some(c => c.name === 'refreshToken'), false);
    assert.deepEqual(errors, []);
    console.log('PASS: expired access-token logout rotates then revokes session, clears cookie, survives reload');
    // Two tabs share a session and may both refresh/logout at the same time.
    await page.evaluate(token => {
      localStorage.setItem('dc_access_token', token);
      localStorage.setItem('dc_has_session', 'true');
      localStorage.setItem('dc_session_generation', 'two-tabs');
    }, accounts.a.token);
    await context.addCookies([{ name:'refreshToken',value:accounts.a.cookie.split('=')[1],domain:'localhost',path:'/api/v1/auth',httpOnly:true,sameSite:'Lax' }]);
    await page.goto(base + '/catalog');
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).first().click();
    await expect(page.getByRole('status').filter({hasText:'Đã thêm'})).toBeVisible();
    await page.goto(base + '/cart');
    await expect(page.getByRole('heading', { name: 'Giỏ hàng của bạn' })).toBeVisible();
    await page.goto(base + '/checkout');
    await page.locator('#recipientName').fill('Nguyễn Văn Test');
    await page.locator('#phone').fill('0901234567');
    await page.locator('#line1').fill('12 Đường Kiểm Thử');
    await page.locator('#wardCode').fill('001');
    await page.locator('#provinceCode').fill('01');
    await page.getByRole('button', {name:'Tiến hành đặt hàng',exact:true}).click();
    await page.waitForURL(/\/orders\/[a-f0-9-]+$/);
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
    await page.screenshot({path:path.join(screenshots,'order-desktop.png'),fullPage:true});
    console.log('PASS: PostgreSQL storefront -> cart -> checkout -> order detail');
    const other = await context.newPage();
    await other.goto(base + '/catalog');
    await expect(other.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible();
    const aPayload = jwt.decode(accounts.a.token); delete aPayload.iat; delete aPayload.exp;
    await page.evaluate(token => {
      // The other tab reacts to this storage event and starts session recovery.
      localStorage.setItem('dc_access_token', token);
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Đăng xuất').click();
    },jwt.sign(aPayload,{expiresIn:-1}));
    await expect.poll(() => page.evaluate(() => localStorage.getItem('dc_access_token'))).toBe(null);
    assert.equal(Number((await ds.query('SELECT count(*) AS n FROM user_sessions WHERE user_id=$1 AND NOT is_revoked',[accounts.a.userId]))[0].n),0);
    await expect(other.getByRole('button',{name:'Đăng xuất',exact:true})).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log('PASS: concurrent logout/refresh across two browser tabs');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (frontend) await frontend.close();
  }
};
