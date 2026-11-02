require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const root = path.resolve(__dirname, '../../..');
const env = parseEnv(fs.readFileSync(path.join(root, 'backend/.env'), 'utf8'));
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.DATABASE_SSL = env.DATABASE_SSL || 'false';
process.env.DEMO_AUTH_ENABLED = 'false';
process.env.JWT_SECRET = env.JWT_SECRET || 'dropconnect-live-verification-secret-2026';

const { AppModule } = require('../../dist/app.module');
const { HttpExceptionFilter } = require('../../dist/common/errors/http-exception.filter');
const { ResponseTransformInterceptor } = require('../../dist/common/http/response.interceptor');

(async () => {
  console.log('--- BẮT ĐẦU KIỂM TRA TOÀN DIỆN VỚI DATABASE THẬT ---');
  console.log('DB:', env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  await app.init();
  const http = request(app.getHttpServer());

  const testSuffix = Date.now().toString().slice(-6);
  const password = 'Password123!@#';

  const report = [];

  try {
    // 1. Health check
    const health = await http.get('/health');
    assert.equal(health.status, 200);
    report.push({ step: '1. Health check', status: 'PASS', data: health.body });

    // 2. Public Catalog & Listings khi DB rỗng
    const catalog = await http.get('/api/v1/catalog/products');
    assert.equal(catalog.status, 200);
    assert.ok(Array.isArray(catalog.body.data));
    const listings = await http.get('/api/v1/listings');
    assert.equal(listings.status, 200);
    assert.ok(Array.isArray(listings.body.data));
    report.push({ step: '2. Public Catalog & Listings query', status: 'PASS', itemsCount: listings.body.data.length });

    // 3. Đăng ký Admin (đăng ký Customer rồi cấp quyền trực tiếp trong DB)
    const adminEmail = `admin_${testSuffix}@example.com`;
    const regAdmin = await http.post('/api/v1/auth/register').send({ email: adminEmail, password, role: 'CUSTOMER' });
    assert.equal(regAdmin.status, 201);
    const adminUserId = regAdmin.body.data.userId;

    const { DataSource } = require('typeorm');
    const ds = app.get(DataSource);
    await ds.query("INSERT INTO user_role_memberships(user_id, role, status) VALUES($1, 'ADMIN', 'ACTIVE')", [adminUserId]);

    const loginAdmin = await http.post('/api/v1/auth/login').send({ email: adminEmail, password });
    assert.equal(loginAdmin.status, 200);
    let adminToken = loginAdmin.body.data.accessToken;

    const switchAdminRole = await http.post('/api/v1/me/active-role').auth(adminToken, { type: 'bearer' }).send({ role: 'ADMIN' });
    assert.equal(switchAdminRole.status, 200);
    adminToken = switchAdminRole.body.data.accessToken;
    report.push({ step: '3. Admin registration & Role switch', status: 'PASS', adminEmail });

    // 4. Đăng ký Supplier & Seller (ở trạng thái PENDING)
    const supplierEmail = `supplier_${testSuffix}@example.com`;
    const regSupplier = await http.post('/api/v1/auth/register').send({ email: supplierEmail, password, role: 'SUPPLIER' });
    assert.equal(regSupplier.status, 201);
    const supplierUserId = regSupplier.body.data.userId;

    const sellerEmail = `seller_${testSuffix}@example.com`;
    const regSeller = await http.post('/api/v1/auth/register').send({ email: sellerEmail, password, role: 'SELLER' });
    assert.equal(regSeller.status, 201);
    const sellerUserId = regSeller.body.data.userId;

    // Login Supplier & Seller khi PENDING -> không thể switch role
    const loginSupp = await http.post('/api/v1/auth/login').send({ email: supplierEmail, password });
    assert.equal(loginSupp.status, 200);
    const suppTokenRaw = loginSupp.body.data.accessToken;
    const switchSuppFail = await http.post('/api/v1/me/active-role').auth(suppTokenRaw, { type: 'bearer' }).send({ role: 'SUPPLIER' });
    assert.equal(switchSuppFail.status, 403, 'Pending supplier cannot switch to SUPPLIER role');
    report.push({ step: '4. Register Supplier/Seller & Block pending role switch', status: 'PASS' });

    // 5. Admin duyệt hồ sơ Supplier & Seller
    const pendingSuppliers = await http.get('/api/v1/admin/profiles?role=SUPPLIER').auth(adminToken, { type: 'bearer' });
    assert.equal(pendingSuppliers.status, 200);
    const suppProfile = pendingSuppliers.body.data.find(p => p.userId === supplierUserId);
    assert.ok(suppProfile, 'Supplier profile found in Admin queue');

    const approveSupp = await http.post(`/api/v1/admin/profiles/${suppProfile.id}/decision`).auth(adminToken, { type: 'bearer' }).send({
      role: 'SUPPLIER', decision: 'APPROVED'
    });
    assert.equal(approveSupp.status, 200);

    const pendingSellers = await http.get('/api/v1/admin/profiles?role=SELLER').auth(adminToken, { type: 'bearer' });
    assert.equal(pendingSellers.status, 200);
    const sellProfile = pendingSellers.body.data.find(p => p.userId === sellerUserId);
    assert.ok(sellProfile, 'Seller profile found in Admin queue');

    const approveSell = await http.post(`/api/v1/admin/profiles/${sellProfile.id}/decision`).auth(adminToken, { type: 'bearer' }).send({
      role: 'SELLER', decision: 'APPROVED'
    });
    assert.equal(approveSell.status, 200);
    report.push({ step: '5. Admin profile approval (Supplier + Seller)', status: 'PASS' });

    // 6. Supplier & Seller switch role sang APPROVED
    const suppRole = await http.post('/api/v1/me/active-role').auth(suppTokenRaw, { type: 'bearer' }).send({ role: 'SUPPLIER' });
    assert.equal(suppRole.status, 200);
    const suppToken = suppRole.body.data.accessToken;

    const loginSell = await http.post('/api/v1/auth/login').send({ email: sellerEmail, password });
    const sellRole = await http.post('/api/v1/me/active-role').auth(loginSell.body.data.accessToken, { type: 'bearer' }).send({ role: 'SELLER' });
    assert.equal(sellRole.status, 200);
    const sellToken = sellRole.body.data.accessToken;
    report.push({ step: '6. Role switch after approval', status: 'PASS' });

    // 7. Supplier tải ảnh lên máy chủ, tạo sản phẩm nguồn và nhập kho
    const uploadRes = await http.post('/api/v1/uploads')
      .auth(suppToken, { type: 'bearer' })
      .attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'), 'cable.png');
    assert.equal(uploadRes.status, 201);
    assert.ok(uploadRes.body.data.url.startsWith('/uploads/'));
    const uploadedImageUrl = uploadRes.body.data.url;

    const prodRes = await http.post('/api/v1/supplier/products').auth(suppToken, { type: 'bearer' }).send({
      name: `Cáp sạc Type-C nhanh 65W Pro ${testSuffix}`,
      supplierSku: `SKU-CBL-${testSuffix}`,
      description: 'Cáp bọc dù chống đứt, công nghệ Power Delivery 65W',
      costPrice: 50000,
      imageUrl: uploadedImageUrl,
    });
    assert.equal(prodRes.status, 201);
    const product = prodRes.body.data;
    assert.equal(product.status, 'DRAFT');
    assert.equal(product.imageUrl, uploadedImageUrl);

    // Kích hoạt sản phẩm
    const actProd = await http.patch(`/api/v1/supplier/products/${product.id}`).auth(suppToken, { type: 'bearer' }).send({ status: 'ACTIVE' });
    assert.equal(actProd.status, 200);

    // Nhập kho
    const stockRes = await http.post('/api/v1/supplier/inventory/adjustments').auth(suppToken, { type: 'bearer' }).send({
      productId: product.id,
      delta: 100,
      reasonCode: 'INITIAL_STOCK',
      sourceRef: `receipt-${testSuffix}`,
    });
    assert.equal(stockRes.status, 201);
    assert.equal(stockRes.body.data.available, 100);
    report.push({ step: '7. Supplier product creation & stock receipt', status: 'PASS', productId: product.id, stock: 100 });

    // 8. Seller tạo Shop và Niêm yết (Listing)
    const shopRes = await http.post('/api/v1/seller/shops').auth(sellToken, { type: 'bearer' }).send({
      name: `Phụ Kiện Số 247 Shop ${testSuffix}`,
    });
    assert.equal(shopRes.status, 201);
    const shop = shopRes.body.data;

    // Kích hoạt Shop
    await http.patch(`/api/v1/seller/shops/${shop.id}`).auth(sellToken, { type: 'bearer' }).send({ status: 'ACTIVE' });

    // Tạo niêm yết với giá bán 89,000 VND (giá sỉ 50,000 VND -> lãi 39,000 VND)
    const listingRes = await http.post('/api/v1/seller/listings').auth(sellToken, { type: 'bearer' }).send({
      productId: product.id,
      shopId: shop.id,
      salePrice: 89000,
      sellerSku: `SELL-CBL-${testSuffix}`,
    });
    assert.equal(listingRes.status, 201);
    const listing = listingRes.body.data;
    assert.equal(listing.status, 'DRAFT');

    // Xuất bản (publish) niêm yết
    const pubRes = await http.post(`/api/v1/seller/listings/${listing.id}/publish`).auth(sellToken, { type: 'bearer' }).send({});
    assert.equal(pubRes.status, 201);
    assert.equal(pubRes.body.data.status, 'ACTIVE');
    report.push({ step: '8. Seller shop & published listing', status: 'PASS', listingId: listing.id, salePrice: 89000 });

    // 9. Customer đăng ký, xem giỏ hàng và mua hàng
    const custEmail = `customer_${testSuffix}@example.com`;
    const regCust = await http.post('/api/v1/auth/register').send({ email: custEmail, password, role: 'CUSTOMER' });
    assert.equal(regCust.status, 201);
    const loginCust = await http.post('/api/v1/auth/login').send({ email: custEmail, password });
    assert.equal(loginCust.status, 200);
    const custToken = loginCust.body.data.accessToken;

    // Xem thông tin cá nhân
    const meCust = await http.get('/api/v1/me').auth(custToken, { type: 'bearer' });
    assert.equal(meCust.status, 200);
    assert.equal(meCust.body.data.email, custEmail);

    // Thêm vào giỏ hàng
    const addCart = await http.put(`/api/v1/cart/items/${listing.id}`).auth(custToken, { type: 'bearer' }).send({ quantity: 2 });
    assert.equal(addCart.status, 200);
    assert.equal(addCart.body.data.items.length, 1);
    assert.equal(addCart.body.data.items[0].quantity, 2);
    const cartId = addCart.body.data.cartId;

    // Xem giỏ hàng
    const getCart = await http.get('/api/v1/cart').auth(custToken, { type: 'bearer' });
    assert.equal(getCart.status, 200);
    assert.equal(getCart.body.data.cartId, cartId);
    report.push({ step: '9. Customer cart operations', status: 'PASS', cartId, items: 2 });

    // 10. Tiến hành Checkout đơn hàng (COD)
    const idempotencyKey = `idemp-${testSuffix}`;
    const checkoutRes = await http.post('/api/v1/checkout')
      .auth(custToken, { type: 'bearer' })
      .set('Idempotency-Key', idempotencyKey)
      .send({
        cartId,
        paymentMethod: 'COD',
        shippingAddress: {
          recipientName: 'Nguyễn Văn Test',
          phone: '0912345678',
          line1: '123 Đường Công Nghệ',
          wardCode: 'WARD-01',
          provinceCode: 'PROV-79',
        },
      });
    assert.equal(checkoutRes.status, 201);
    const orderData = checkoutRes.body.data;
    assert.ok(orderData.orderId);
    assert.equal(orderData.totalPayable, 89000 * 2);
    assert.equal(orderData.fulfillmentOrders.length, 1);

    // Thử gửi lại cùng idempotency key -> phải trả lại cùng đơn hàng (idempotent replay)
    const replayRes = await http.post('/api/v1/checkout')
      .auth(custToken, { type: 'bearer' })
      .set('Idempotency-Key', idempotencyKey)
      .send({
        cartId,
        paymentMethod: 'COD',
        shippingAddress: {
          recipientName: 'Nguyễn Văn Test',
          phone: '0912345678',
          line1: '123 Đường Công Nghệ',
          wardCode: 'WARD-01',
          provinceCode: 'PROV-79',
        },
      });
    assert.equal(replayRes.status, 201);
    assert.equal(replayRes.body.data.orderId, orderData.orderId);
    report.push({ step: '10. Atomic checkout & Idempotent replay', status: 'PASS', orderId: orderData.orderId });

    // 11. Kiểm tra chi tiết đơn hàng (không lộ giá sỉ)
    const orderDetail = await http.get(`/api/v1/orders/${orderData.orderId}`).auth(custToken, { type: 'bearer' });
    assert.equal(orderDetail.status, 200);
    const orderDetailStr = JSON.stringify(orderDetail.body);
    assert.ok(!orderDetailStr.includes('unitCostPrice'), 'Customer cannot see unitCostPrice');
    assert.ok(!orderDetailStr.includes('costPrice'), 'Customer cannot see costPrice');
    report.push({ step: '11. Order detail query & Cost price privacy', status: 'PASS' });

    // 12. Kiểm tra tồn kho sau khi giữ hàng (100 - 2 = 98)
    const suppStock = await http.get(`/api/v1/supplier/inventory/products/${product.id}`).auth(suppToken, { type: 'bearer' });
    assert.equal(suppStock.status, 200);
    assert.equal(suppStock.body.data.available, 98);
    assert.equal(suppStock.body.data.heldQuantity, 2);
    report.push({ step: '12. Inventory hold verification', status: 'PASS', available: 98, held: 2 });

    // 13. Kiểm tra thông báo (Notifications) được tạo tự động
    const suppNotifs = await http.get('/api/v1/notifications').auth(suppToken, { type: 'bearer' });
    assert.equal(suppNotifs.status, 200);
    assert.ok(suppNotifs.body.data.items.length > 0, 'Supplier received order notification');

    const custNotifs = await http.get('/api/v1/notifications').auth(custToken, { type: 'bearer' });
    assert.equal(custNotifs.status, 200);
    assert.ok(custNotifs.body.data.items.length > 0, 'Customer received order notification');
    report.push({ step: '13. Notifications dispatched for Supplier and Customer', status: 'PASS' });

    // 14. Kiểm tra Audit logs
    const auditLogs = await http.get('/api/v1/admin/audit').auth(adminToken, { type: 'bearer' });
    assert.equal(auditLogs.status, 200);
    assert.ok(Array.isArray(auditLogs.body.data) && auditLogs.body.data.length > 0, 'Audit logs recorded');
    report.push({ step: '14. Admin audit trail recorded', status: 'PASS', count: auditLogs.body.data.length });

    console.log('\n=== KẾT QUẢ KIỂM TRA DATABASE THẬT ===');
    console.table(report);
    console.log('TẤT CẢ 14 BƯỚC KIỂM TRA ĐỀU THÀNH CÔNG RỰC RỠ TRÊN POSTGRESQL THẬT!');

  } finally {
    await app.close();
  }
})().catch(err => {
  console.error('LỖI KIỂM TRA:', err);
  process.exitCode = 1;
});
