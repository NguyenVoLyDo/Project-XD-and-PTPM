// Run after building both apps: node backend/test/integration/browser-smoke.cjs
// Isolated in-memory API; production frontend; real Chromium; no shared data.
require('reflect-metadata');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { chromium, expect } = require('@playwright/test');
const { DemoAppModule: AppModule } = require('../../dist/demo-app.module');
const { GlobalExceptionFilter } = require('../../dist/common/errors/http-exception.filter');
const { ResponseTransformInterceptor } = require('../../dist/common/http/response.interceptor');
const { DemoCheckoutState } = require('../../dist/integration/store-adapters.service');
const root = path.resolve(__dirname, '../../..');
const next = require(path.join(root, 'frontend/node_modules/next'));

(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DEMO_AUTH_ENABLED = 'true';
  let api, frontend, server, browser;
  const screenshots = path.join(root, 'test-results/ui-refresh');
  fs.mkdirSync(screenshots, { recursive: true });
  try {
    api = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    api.enableCors({ origin: true, credentials: true });
    api.useGlobalFilters(new GlobalExceptionFilter());
    api.useGlobalInterceptors(new ResponseTransformInterceptor());
    await api.listen(0, '127.0.0.1');
    const apiUrl = await api.getUrl();
    frontend = next({ dev: false, dir: path.join(root, 'frontend') });
    await frontend.prepare();
    server = http.createServer(frontend.getRequestHandler());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, chromium.executablePath(),
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(candidate => candidate && fs.existsSync(candidate));
    if (!executablePath) throw new Error('No installed Chromium browser found');
    browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failListings = false;
    await page.route('http://localhost:4000/api/v1/**', async route => {
      const url = new URL(route.request().url());
      if (failListings && url.pathname === '/api/v1/listings/page') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable' }) });
        return;
      }
      const response = await route.fetch({ url: apiUrl + url.pathname + url.search });
      await route.fulfill({ response });
    });
    async function capture(name) {
      await expect(page.locator('.animate-pulse')).toHaveCount(0);
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.activeElement?.blur();
        document.querySelectorAll('img').forEach(img => img.loading = 'eager');
        await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
        window.scrollTo(0, 0);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true, animations: 'disabled' });
    }
    await page.goto(base);
    await expect(page.locator('.product-card')).toHaveCount(3);
    await capture('home-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('home-mobile');
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Điều hướng di động' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Điều hướng di động' }).getByRole('link', { name: 'Khám phá', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(3);
    await page.waitForURL('**/catalog');
    await expect(page.locator('.product-card')).toHaveCount(3);
    await capture('catalog-mobile');
    await page.getByLabel('Tìm sản phẩm', { exact: true }).fill('anker');
    await expect(page.locator('.product-card')).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get('q')).toBe('anker');
    await page.getByLabel('Tìm sản phẩm', { exact: true }).fill('no-such-product');
    await expect(page.getByText('Chưa tìm thấy sản phẩm phù hợp')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await page.getByLabel('Nhà cung cấp', { exact: true }).selectOption('prof-supp-b');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await page.getByLabel('Sắp xếp', { exact: true }).selectOption('price-asc');
    await expect(page.locator('.product-card').first()).toContainText('Baseus');
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture('catalog-desktop');
    const addButtons = page.getByRole('button', { name: 'Thêm vào giỏ', exact: true });
    for (const index of [0, 1]) {
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/cart/items/') && response.request().method() === 'PUT'),
        addButtons.nth(index).click(),
      ]);
      await expect(addButtons.nth(index)).toBeEnabled();
    }
    await page.goto(base + '/cart');
    await expect(page.getByRole('heading', { name: 'Giỏ hàng của bạn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xóa sản phẩm', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Xóa sản phẩm', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await capture('cart-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('cart-mobile');
    await page.goto(base + '/checkout');
    await expect(page.getByText('2 kiện hàng phân tách', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tiến hành đặt hàng', exact: true }).click();
    await expect(page.locator('#recipientName')).toBeFocused();
    await expect(page.getByText('Nhập họ tên người nhận.')).toBeVisible();
    await page.getByLabel('Họ và tên', { exact: false }).fill('Nguyễn Văn An');
    await page.getByLabel('Số điện thoại', { exact: false }).fill('0901234567');
    await page.getByLabel('Địa chỉ nhận hàng', { exact: false }).fill('12 Nguyễn Huệ');
    await page.getByLabel('Phường / Xã').fill('Bến Nghé');
    await page.getByLabel('Tỉnh / Thành phố').fill('TP. Hồ Chí Minh');
    await capture('checkout-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture('checkout-desktop');
    await page.getByRole('button', { name: 'Tiến hành đặt hàng', exact: true }).click();
    await page.waitForURL(/\/orders\/[a-f0-9-]+$/, { timeout: 15000 });
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
    await capture('order-desktop');
    const state = api.get(DemoCheckoutState);
    expect(state.orders.size).toBe(1);
    expect([...state.orders.values()][0].fulfillmentOrders).toHaveLength(2);
    await page.getByLabel('Bản demo', { exact: true }).selectOption('u-seller-x');
    await page.goto(base + '/seller/listings');
    await expect(page.getByRole('heading', { name: 'Gian hàng & giá bán' })).toBeVisible();
    await capture('seller-desktop');
    await page.getByLabel('Bản demo', { exact: true }).selectOption('u-supplier-a');
    await page.goto(base + '/supplier/products');
    await expect(page.getByRole('heading', { name: 'Sản phẩm & tồn kho' })).toBeVisible();
    await capture('supplier-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('supplier-mobile');
    failListings = true;
    await page.goto(base + '/catalog');
    await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được sản phẩm' })).toBeVisible();
    failListings = false;
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(3);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ browserSmoke: 'PASS', path: 'catalog -> cart -> checkout -> order detail', orders: 1, supplierGroups: 2, filters: 'PASS', validation: 'PASS', responsive: 'PASS', retry: 'PASS', pageErrors: errors.length, screenshots }));
  } finally {
    await browser?.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await frontend?.close();
    await api?.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
