const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const argon2 = require('argon2');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/dropconnect';

async function main() {
  console.log('--- BẮT ĐẦU TẠO DỮ LIỆU TEST & TÀI KHOẢN MẪU ---');

  // 1. Sinh mã băm Argon2id cho mật khẩu '123456789'
  const plainPassword = '123456789';
  const passwordHash = await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
  console.log('Argon2id Hash cho "123456789":', passwordHash);

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 2. Danh sách 12 tài khoản test (3 Admin, 3 Seller, 3 Supplier, 3 Customer)
    const accounts = [
      // --- 3 ADMINS ---
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'admin1@dropconnect.vn',
        name: 'Nguyễn Văn Admin (Super Admin)',
        roles: ['ADMIN', 'CUSTOMER'],
      },
      {
        id: '11111111-1111-4111-8111-222222222222',
        email: 'admin2@dropconnect.vn',
        name: 'Lê Vận Hành (Operations Admin)',
        roles: ['ADMIN', 'CUSTOMER'],
      },
      {
        id: '11111111-1111-4111-8111-333333333333',
        email: 'admin3@dropconnect.vn',
        name: 'Trần Kiểm Soát (Audit & Dispute Admin)',
        roles: ['ADMIN', 'CUSTOMER'],
      },

      // --- 3 SELLERS ---
      {
        id: '22222222-2222-4222-8222-111111111111',
        email: 'seller1@dropconnect.vn',
        name: 'TechZone Store (Phụ Kiện Công Nghệ)',
        roles: ['SELLER', 'CUSTOMER'],
        sellerProfileId: 'bbbbbbbb-2222-4222-8222-111111111111',
        displayName: 'TechZone Official Store',
        shopId: 'cccccccc-2222-4222-8222-111111111111',
        shopName: 'TechZone Official Shop',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'seller2@dropconnect.vn',
        name: 'EcoHome Living (Gia Dụng & Đời Sống)',
        roles: ['SELLER', 'CUSTOMER'],
        sellerProfileId: 'bbbbbbbb-2222-4222-8222-222222222222',
        displayName: 'EcoHome Living Store',
        shopId: 'cccccccc-2222-4222-8222-222222222222',
        shopName: 'EcoHome Living Shop',
      },
      {
        id: '22222222-2222-4222-8222-333333333333',
        email: 'seller3@dropconnect.vn',
        name: 'UrbanStyle GenZ (Thời Trang & Balo)',
        roles: ['SELLER', 'CUSTOMER'],
        sellerProfileId: 'bbbbbbbb-2222-4222-8222-333333333333',
        displayName: 'UrbanStyle Vietnam',
        shopId: 'cccccccc-2222-4222-8222-333333333333',
        shopName: 'UrbanStyle Shop',
      },

      // --- 3 SUPPLIERS ---
      {
        id: '33333333-3333-4333-8333-111111111111',
        email: 'supplier1@dropconnect.vn',
        name: 'Tổng Kho Phụ Kiện Số Việt Nam',
        roles: ['SUPPLIER', 'CUSTOMER'],
        supplierProfileId: 'aaaaaaaa-3333-4333-8333-111111111111',
        legalName: 'Công ty TNHH Phụ Kiện Số Việt Nam',
        payoutAccountRef: 'VCB-001100223344',
      },
      {
        id: '33333333-3333-4333-8333-222222222222',
        email: 'supplier2@dropconnect.vn',
        name: 'Tổng Kho Gia Dụng Việt Đức',
        roles: ['SUPPLIER', 'CUSTOMER'],
        supplierProfileId: 'aaaaaaaa-3333-4333-8333-222222222222',
        legalName: 'Công ty CP Gia Dụng Tiện Ích Việt Đức',
        payoutAccountRef: 'TCB-190388889999',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'supplier3@dropconnect.vn',
        name: 'Xưởng May Balo & Thời Trang An Bình',
        roles: ['SUPPLIER', 'CUSTOMER'],
        supplierProfileId: 'aaaaaaaa-3333-4333-8333-333333333333',
        legalName: 'Xưởng Sản Xuất May Mặc An Bình',
        payoutAccountRef: 'MB-098877665544',
      },

      // --- 3 CUSTOMERS ---
      {
        id: '44444444-4444-4444-8444-111111111111',
        email: 'customer1@dropconnect.vn',
        name: 'Nguyễn Hoàng Nam (Khách Hàng VIP)',
        roles: ['CUSTOMER'],
      },
      {
        id: '44444444-4444-4444-8444-222222222222',
        email: 'customer2@dropconnect.vn',
        name: 'Trần Thảo Ly (Khách Hàng Thường)',
        roles: ['CUSTOMER'],
      },
      {
        id: '44444444-4444-4444-8444-333333333333',
        email: 'customer3@dropconnect.vn',
        name: 'Phạm Quang Minh (Khách Hàng Mới)',
        roles: ['CUSTOMER'],
      },

      // --- LEGACY DEMO ACCOUNTS (CHO FRONTEND QUICK SWITCHER) ---
      {
        id: '11111111-1111-4111-8111-000000000000',
        email: 'admin@dropconnect.vn',
        name: 'Admin Hệ Thống',
        roles: ['ADMIN', 'CUSTOMER'],
      },
      {
        id: '22222222-2222-4222-8222-000000000000',
        email: 'sellerx@techstore.vn',
        name: 'Seller X (TechStore)',
        roles: ['SELLER', 'CUSTOMER'],
        sellerProfileId: 'bbbbbbbb-2222-4222-8222-000000000000',
        displayName: 'TechStore Legacy',
        shopId: 'cccccccc-2222-4222-8222-000000000000',
        shopName: 'TechStore Legacy Shop',
      },
      {
        id: '33333333-3333-4333-8333-000000000001',
        email: 'suppliera@phukienviet.vn',
        name: 'Supplier A (Phụ Kiện Việt)',
        roles: ['SUPPLIER', 'CUSTOMER'],
        supplierProfileId: 'aaaaaaaa-3333-4333-8333-000000000001',
        legalName: 'Phụ Kiện Việt Legacy',
        payoutAccountRef: 'VCB-0001',
      },
      {
        id: '33333333-3333-4333-8333-000000000002',
        email: 'supplierb@giadungviet.vn',
        name: 'Supplier B (Gia Dụng B&C)',
        roles: ['SUPPLIER', 'CUSTOMER'],
        supplierProfileId: 'aaaaaaaa-3333-4333-8333-000000000002',
        legalName: 'Gia Dụng B&C Legacy',
        payoutAccountRef: 'TCB-0002',
      },
      {
        id: '44444444-4444-4444-8444-000000000000',
        email: 'customer@gmail.com',
        name: 'Khách hàng C',
        roles: ['CUSTOMER'],
      },
    ];

    console.log('-> Đang chèn 12 tài khoản vào bảng `users` và `user_role_memberships`...');
    for (const acc of accounts) {
      await client.query(`
        INSERT INTO users (id, email, password_hash, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';
      `, [acc.id, acc.email, passwordHash]);

      for (const role of acc.roles) {
        await client.query(`
          INSERT INTO user_role_memberships (user_id, role, status)
          VALUES ($1, $2, 'ACTIVE')
          ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE';
        `, [acc.id, role]);
      }

      // Nếu là Seller
      if (acc.sellerProfileId) {
        await client.query(`
          INSERT INTO seller_profiles (id, user_id, display_name, approval_status)
          VALUES ($1, $2, $3, 'APPROVED')
          ON CONFLICT (user_id) DO UPDATE 
          SET display_name = EXCLUDED.display_name, approval_status = 'APPROVED';
        `, [acc.sellerProfileId, acc.id, acc.displayName]);

        await client.query(`
          INSERT INTO shops (id, seller_id, name, status)
          VALUES ($1, $2, $3, 'ACTIVE')
          ON CONFLICT (id) DO UPDATE 
          SET name = EXCLUDED.name, status = 'ACTIVE';
        `, [acc.shopId, acc.sellerProfileId, acc.shopName]);
      }

      // Nếu là Supplier
      if (acc.supplierProfileId) {
        await client.query(`
          INSERT INTO supplier_profiles (id, user_id, legal_name, approval_status, payout_account_ref)
          VALUES ($1, $2, $3, 'APPROVED', $4)
          ON CONFLICT (user_id) DO UPDATE 
          SET legal_name = EXCLUDED.legal_name, approval_status = 'APPROVED', payout_account_ref = EXCLUDED.payout_account_ref;
        `, [acc.supplierProfileId, acc.id, acc.legalName, acc.payoutAccountRef]);
      }
    }

    // 3. Danh mục Sản phẩm mẫu đa dạng (Products) từ 3 Nhà cung cấp
    console.log('-> Đang chèn danh mục sản phẩm mẫu (`products`)...');
    const products = [
      // Supplier 1: Thiết bị điện tử & Phụ kiện công nghệ
      {
        id: '55555555-5555-4555-8555-111111111111',
        supplierId: 'aaaaaaaa-3333-4333-8333-111111111111',
        sku: 'SP1-BASEUS-GAN65W',
        name: 'Củ sạc nhanh 65W GaN 3 cổng Baseus GaN5 Pro',
        desc: 'Công nghệ GaN5 nhỏ gọn, sạc nhanh cho Laptop và điện thoại, 2 Type-C + 1 USB.',
        cost: 260000,
        stock: 150,
        image: '/images/charger.jpg',
      },
      {
        id: '55555555-5555-4555-8555-222222222222',
        supplierId: 'aaaaaaaa-3333-4333-8333-111111111111',
        sku: 'SP1-CABLE-100W',
        name: 'Cáp sạc Type-C to Type-C 100W bọc dù siêu bền 1.2m',
        desc: 'Hỗ trợ PD 100W, chip E-Marker an toàn chống cháy nổ, bọc dù chống gãy gập.',
        cost: 45000,
        stock: 300,
        image: '/images/cable.jpg',
      },
      {
        id: '55555555-5555-4555-8555-333333333333',
        supplierId: 'aaaaaaaa-3333-4333-8333-111111111111',
        sku: 'SP1-BOWIE-E16',
        name: 'Tai nghe Bluetooth True Wireless Baseus Bowie E16',
        desc: 'Âm bass mạnh mẽ, chống nước IPX4, thời lượng pin 30 giờ, độ trễ thấp 0.06s.',
        cost: 160000,
        stock: 120,
        image: '/images/earbuds.jpg',
      },
      {
        id: '55555555-5555-4555-8555-444444444444',
        supplierId: 'aaaaaaaa-3333-4333-8333-111111111111',
        sku: 'SP1-MOUSE-M330',
        name: 'Chuột không dây Silent SilentClick M330 2.4GHz',
        desc: 'Không gây tiếng ồn, thiết kế công thái học vừa vặn lòng bàn tay, pin 18 tháng.',
        cost: 120000,
        stock: 80,
        image: '/images/mouse.jpg',
      },

      // Supplier 2: Gia dụng & Đời sống
      {
        id: '55555555-5555-4555-8555-555555555555',
        supplierId: 'aaaaaaaa-3333-4333-8333-222222222222',
        sku: 'SP2-LOCK-500ML',
        name: 'Bình giữ nhiệt Inox 316 Lock&Lock Energetic 500ml',
        desc: 'Chất liệu Inox 316 cao cấp chống gỉ, giữ nhiệt 12h-24h, nắp mở 1 chạm tiện lợi.',
        cost: 210000,
        stock: 100,
        image: '/images/bottle.jpg',
      },
      {
        id: '55555555-5555-4555-8555-666666666666',
        supplierId: 'aaaaaaaa-3333-4333-8333-222222222222',
        sku: 'SP2-BLENDER-USB',
        name: 'Máy xay sinh tố cầm tay 6 lưỡi dao sạc USB 400ml',
        desc: 'Dao inox 304 sắc bén, xay nhuyễn đá nhỏ và hoa quả nhanh trong 30 giây.',
        cost: 135000,
        stock: 90,
        image: '/images/blender.jpg',
      },
      {
        id: '55555555-5555-4555-8555-777777777777',
        supplierId: 'aaaaaaaa-3333-4333-8333-222222222222',
        sku: 'SP2-AIRFRYER-6L',
        name: 'Nồi chiên không dầu điện tử điều khiển cảm ứng 6.5L',
        desc: 'Công suất 1800W, công nghệ Rapid Air giảm 85% mỡ thừa, 8 chế độ tự động.',
        cost: 790000,
        stock: 40,
        image: '/images/airfryer.jpg',
      },

      // Supplier 3: May mặc & Balo Thời trang
      {
        id: '55555555-5555-4555-8555-888888888888',
        supplierId: 'aaaaaaaa-3333-4333-8333-333333333333',
        sku: 'SP3-BACKPACK-156',
        name: 'Balo laptop công sở chống nước đa năng 15.6 inch',
        desc: 'Vải Oxford cao cấp trượt nước, có cổng sạc USB ngoài, ngăn chống sốc chuyên dụng.',
        cost: 155000,
        stock: 150,
        image: '/images/backpack.jpg',
      },
      {
        id: '55555555-5555-4555-8555-999999999999',
        supplierId: 'aaaaaaaa-3333-4333-8333-333333333333',
        sku: 'SP3-POLO-COTTON',
        name: 'Áo thun nam Polo trơn Cotton Compact thoáng khí',
        desc: 'Cotton dệt sợi Compact cao cấp, thấm hút mồ hôi, co giãn 4 chiều, không nhăn xù.',
        cost: 85000,
        stock: 250,
        image: '/images/polo.jpg',
      },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO products (id, supplier_id, supplier_sku, name, description, cost_price, available_stock, status, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
        ON CONFLICT (supplier_id, supplier_sku) DO UPDATE 
        SET name = EXCLUDED.name, description = EXCLUDED.description, 
            cost_price = EXCLUDED.cost_price, available_stock = EXCLUDED.available_stock, 
            status = 'ACTIVE', image_url = EXCLUDED.image_url;
      `, [p.id, p.supplierId, p.sku, p.name, p.desc, p.cost, p.stock, p.image]);
    }

    // 4. Danh mục Niêm yết sản phẩm (Listings) do các Seller bán
    console.log('-> Đang chèn niêm yết bán hàng (`listings`)...');
    const listings = [
      // Seller 1 (TechZone Store) bán đồ công nghệ của Supplier 1 & 1 món gia dụng của Supplier 2
      {
        id: '66666666-6666-4666-8666-111111111111',
        productId: '55555555-5555-4555-8555-111111111111',
        shopId: 'cccccccc-2222-4222-8222-111111111111',
        sellerSku: 'TZ-BASEUS-65W',
        salePrice: 359000,
      },
      {
        id: '66666666-6666-4666-8666-222222222222',
        productId: '55555555-5555-4555-8555-222222222222',
        shopId: 'cccccccc-2222-4222-8222-111111111111',
        sellerSku: 'TZ-CABLE-100W',
        salePrice: 89000,
      },
      {
        id: '66666666-6666-4666-8666-333333333333',
        productId: '55555555-5555-4555-8555-333333333333',
        shopId: 'cccccccc-2222-4222-8222-111111111111',
        sellerSku: 'TZ-BOWIE-E16',
        salePrice: 249000,
      },
      {
        id: '66666666-6666-4666-8666-444444444444',
        productId: '55555555-5555-4555-8555-555555555555',
        shopId: 'cccccccc-2222-4222-8222-111111111111',
        sellerSku: 'TZ-LOCK-500ML', // Cross-listing từ Supplier 2
        salePrice: 299000,
      },

      // Seller 2 (EcoHome Living) bán đồ gia dụng của Supplier 2
      {
        id: '66666666-6666-4666-8666-555555555555',
        productId: '55555555-5555-4555-8555-555555555555',
        shopId: 'cccccccc-2222-4222-8222-222222222222',
        sellerSku: 'EH-LOCK-500ML',
        salePrice: 289000,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        productId: '55555555-5555-4555-8555-666666666666',
        shopId: 'cccccccc-2222-4222-8222-222222222222',
        sellerSku: 'EH-BLENDER-USB',
        salePrice: 219000,
      },
      {
        id: '66666666-6666-4666-8666-777777777777',
        productId: '55555555-5555-4555-8555-777777777777',
        shopId: 'cccccccc-2222-4222-8222-222222222222',
        sellerSku: 'EH-AIRFRYER-6L',
        salePrice: 1190000,
      },

      // Seller 3 (UrbanStyle GenZ) bán balo, áo thun từ Supplier 3 & sạc GaN từ Supplier 1
      {
        id: '66666666-6666-4666-8666-888888888888',
        productId: '55555555-5555-4555-8555-888888888888',
        shopId: 'cccccccc-2222-4222-8222-333333333333',
        sellerSku: 'US-BACKPACK-156',
        salePrice: 279000,
      },
      {
        id: '66666666-6666-4666-8666-999999999999',
        productId: '55555555-5555-4555-8555-999999999999',
        shopId: 'cccccccc-2222-4222-8222-333333333333',
        sellerSku: 'US-POLO-COTTON',
        salePrice: 169000,
      },
      {
        id: '66666666-6666-4666-8666-aaaaaaaaaaaa',
        productId: '55555555-5555-4555-8555-111111111111',
        shopId: 'cccccccc-2222-4222-8222-333333333333',
        sellerSku: 'US-BASEUS-65W', // Cross-listing từ Supplier 1
        salePrice: 369000,
      },
    ];

    for (const l of listings) {
      await client.query(`
        INSERT INTO listings (id, product_id, shop_id, seller_sku, sale_price, status, visible)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', true)
        ON CONFLICT (shop_id, seller_sku) DO UPDATE 
        SET sale_price = EXCLUDED.sale_price, status = 'ACTIVE', visible = true;
      `, [l.id, l.productId, l.shopId, l.sellerSku, l.salePrice]);
    }

    // 5. Tạo Giỏ hàng mẫu cho Customer 1
    console.log('-> Đang chèn giỏ hàng mẫu cho Customer 1...');
    const cartId = '77777777-7777-4777-8777-111111111111';
    const customer1Id = '44444444-4444-4444-8444-111111111111';
    await client.query(`
      INSERT INTO carts (id, customer_id)
      VALUES ($1, $2)
      ON CONFLICT (customer_id) DO NOTHING;
    `, [cartId, customer1Id]);

    // Thêm 2 món vào giỏ: 1 củ sạc (Seller 1 - Supplier 1) + 1 bình giữ nhiệt (Seller 2 - Supplier 2)
    await client.query(`
      INSERT INTO cart_items (cart_id, listing_id, quantity, last_viewed_unit_sale_price)
      VALUES ($1, '66666666-6666-4666-8666-111111111111', 1, 359000)
      ON CONFLICT (cart_id, listing_id) DO UPDATE SET quantity = 1, last_viewed_unit_sale_price = 359000;
    `, [cartId]);

    await client.query(`
      INSERT INTO cart_items (cart_id, listing_id, quantity, last_viewed_unit_sale_price)
      VALUES ($1, '66666666-6666-4666-8666-555555555555', 2, 289000)
      ON CONFLICT (cart_id, listing_id) DO UPDATE SET quantity = 2, last_viewed_unit_sale_price = 289000;
    `, [cartId]);

    // 6. Tạo các đơn hàng mẫu phong phú (CustomerOrders & FulfillmentOrders)
    console.log('-> Đang chèn các đơn hàng mẫu cho Customer 2 và Customer 3...');

    // Đơn mẫu 1: Customer 2 đặt đơn chia làm 2 kiện (Supplier 1 + Supplier 2), trạng thái PROCESSING
    const order1Id = '88888888-8888-4888-8888-111111111111';
    const customer2Id = '44444444-4444-4444-8444-222222222222';
    await client.query(`
      INSERT INTO customer_orders (id, order_no, customer_id, status, fulfillment_summary, currency, grand_total, total_payable, placed_at)
      VALUES ($1, 'DC-ORD-SPLIT-001', $2, 'PROCESSING', 'PARTIALLY_FULFILLED', 'VND', 608000, 608000, now() - interval '2 days')
      ON CONFLICT (id) DO UPDATE SET status = 'PROCESSING', fulfillment_summary = 'PARTIALLY_FULFILLED';
    `, [order1Id, customer2Id]);

    // Order items đơn 1
    const item1_1 = '99999999-9999-4999-8999-111111111111';
    const item1_2 = '99999999-9999-4999-8999-222222222222';
    await client.query(`
      INSERT INTO order_items (id, customer_order_id, listing_id, product_name_snapshot, quantity, unit_sale_price_snapshot, unit_cost_price_snapshot)
      VALUES 
        ($1, $2, '66666666-6666-4666-8666-333333333333', 'Tai nghe Bluetooth True Wireless Baseus Bowie E16', 1, 249000, 160000),
        ($3, $2, '66666666-6666-4666-8666-111111111111', 'Củ sạc nhanh 65W GaN 3 cổng Baseus GaN5 Pro', 1, 359000, 260000)
      ON CONFLICT (id) DO NOTHING;
    `, [item1_1, order1Id, item1_2]);

    // Kiện hàng 1: Thuộc Supplier 1 (ACCEPTED)
    const fo1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-111111111111';
    await client.query(`
      INSERT INTO fulfillment_orders (id, fulfillment_no, customer_order_id, supplier_id, seller_id, status, tracking_no, currency)
      VALUES ($1, 'FO-001-SUP1', $2, 'aaaaaaaa-3333-4333-8333-111111111111', 'bbbbbbbb-2222-4222-8222-111111111111', 'ACCEPTED', 'VNPOST-888999', 'VND')
      ON CONFLICT (id) DO UPDATE SET status = 'ACCEPTED';
    `, [fo1Id, order1Id]);

    // Đơn mẫu 2: Customer 3 đặt đơn COD, đã hoàn thành FULFILLED
    const order2Id = '88888888-8888-4888-8888-222222222222';
    const customer3Id = '44444444-4444-4444-8444-333333333333';
    await client.query(`
      INSERT INTO customer_orders (id, order_no, customer_id, status, fulfillment_summary, currency, grand_total, total_payable, placed_at)
      VALUES ($1, 'DC-ORD-COD-DELIVERED', $2, 'CONFIRMED', 'FULFILLED', 'VND', 279000, 279000, now() - interval '5 days')
      ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED', fulfillment_summary = 'FULFILLED';
    `, [order2Id, customer3Id]);

    const item2_1 = '99999999-9999-4999-8999-333333333333';
    await client.query(`
      INSERT INTO order_items (id, customer_order_id, listing_id, product_name_snapshot, quantity, unit_sale_price_snapshot, unit_cost_price_snapshot)
      VALUES ($1, $2, '66666666-6666-4666-8666-888888888888', 'Balo laptop công sở chống nước đa năng 15.6 inch', 1, 279000, 155000)
      ON CONFLICT (id) DO NOTHING;
    `, [item2_1, order2Id]);

    const fo2Id = 'aaaaaaaa-aaaa-4aaa-8aaa-222222222222';
    await client.query(`
      INSERT INTO fulfillment_orders (id, fulfillment_no, customer_order_id, supplier_id, seller_id, status, tracking_no, currency)
      VALUES ($1, 'FO-002-DELIVERED', $2, 'aaaaaaaa-3333-4333-8333-333333333333', 'bbbbbbbb-2222-4222-8222-333333333333', 'DELIVERED', 'GHN-99887766', 'VND')
      ON CONFLICT (id) DO UPDATE SET status = 'DELIVERED';
    `, [fo2Id, order2Id]);

    await client.query('COMMIT');
    console.log('✅ ĐÃ NẠP THÀNH CÔNG DỮ LIỆU TEST VÀO POSTGRESQL!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ LỖI KHI NẠP DỮ LIỆU:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
