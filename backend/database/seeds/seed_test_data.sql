-- =========================================================================================
-- DROPCONNECT - DỮ LIỆU MẪU & TÀI KHOẢN TEST HỆ THỐNG (SEED DATA)
-- Phục vụ: Kiểm thử Đồ án Xây dựng và Phát triển Phần mềm - Hệ thống Dropshipping B2B2C
-- Mật khẩu chung cho tất cả tài khoản: 123456789
-- Thuật toán mã hóa mật khẩu: Argon2id (Chuẩn dự án RFC 9106)
--
-- DANH SÁCH 12 TÀI KHOẢN TEST (ĐỦ 3 TÀI KHOẢN CHO 4 ACTOR CHÍNH):
-- 1. ADMIN (3 tài khoản):
--    - admin1@dropconnect.vn    | 123456789 | Super Administrator (Quản trị viên tối cao)
--    - admin2@dropconnect.vn    | 123456789 | Operations Admin (Quản trị vận hành)
--    - admin3@dropconnect.vn    | 123456789 | Audit & Dispute Admin (Kiểm soát & Đối soát)
--
-- 2. SELLER / NGƯỜI BÁN (3 tài khoản):
--    - seller1@dropconnect.vn   | 123456789 | TechZone Official Store (Phụ kiện công nghệ)
--    - seller2@dropconnect.vn   | 123456789 | EcoHome Living Store (Gia dụng & Đời sống)
--    - seller3@dropconnect.vn   | 123456789 | UrbanStyle Vietnam (Thời trang & Balo GenZ)
--
-- 3. SUPPLIER / NHÀ CUNG CẤP (3 tài khoản):
--    - supplier1@dropconnect.vn | 123456789 | Công ty TNHH Phụ Kiện Số Việt Nam
--    - supplier2@dropconnect.vn | 123456789 | Công ty CP Gia Dụng Tiện Ích Việt Đức
--    - supplier3@dropconnect.vn | 123456789 | Xưởng Sản Xuất May Mặc An Bình
--
-- 4. CUSTOMER / NGƯỜI MUA (3 tài khoản):
--    - customer1@dropconnect.vn | 123456789 | Nguyễn Hoàng Nam (Khách VIP - Có giỏ hàng mẫu)
--    - customer2@dropconnect.vn | 123456789 | Trần Thảo Ly (Khách hàng thường - Đơn đang giao)
--    - customer3@dropconnect.vn | 123456789 | Phạm Quang Minh (Khách hàng mới - Đơn hoàn thành & đơn hủy)
-- =========================================================================================

BEGIN;

-- Hash Argon2id tương ứng với mật khẩu: 123456789
-- Parameters: m=65536, t=3, p=1 (Argon2id v=19)
\set default_password_hash '\$argon2id\$v=19\$m=65536,p=1,t=3\$uOogXQHsxB8fd25zYy87xg\$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4'

-- =========================================================================================
-- PHẦN 1: TẠO 12 TÀI KHOẢN NGƯỜI DÙNG (USERS)
-- =========================================================================================

-- 1.1. Ba tài khoản Admin
INSERT INTO users (id, email, password_hash, status)
VALUES 
  ('11111111-1111-4111-8111-111111111111', 'admin1@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('11111111-1111-4111-8111-222222222222', 'admin2@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('11111111-1111-4111-8111-333333333333', 'admin3@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';

-- 1.2. Ba tài khoản Seller (Người bán)
INSERT INTO users (id, email, password_hash, status)
VALUES 
  ('22222222-2222-4222-8222-111111111111', 'seller1@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('22222222-2222-4222-8222-222222222222', 'seller2@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('22222222-2222-4222-8222-333333333333', 'seller3@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';

-- 1.3. Ba tài khoản Supplier (Nhà cung cấp)
INSERT INTO users (id, email, password_hash, status)
VALUES 
  ('33333333-3333-4333-8333-111111111111', 'supplier1@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('33333333-3333-4333-8333-222222222222', 'supplier2@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('33333333-3333-4333-8333-333333333333', 'supplier3@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';

-- 1.4. Ba tài khoản Customer (Khách mua sắm)
INSERT INTO users (id, email, password_hash, status)
VALUES 
  ('44444444-4444-4444-8444-111111111111', 'customer1@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('44444444-4444-4444-8444-222222222222', 'customer2@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('44444444-4444-4444-8444-333333333333', 'customer3@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  -- Legacy demo accounts
  ('11111111-1111-4111-8111-000000000000', 'admin@dropconnect.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('22222222-2222-4222-8222-000000000000', 'sellerx@techstore.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('33333333-3333-4333-8333-000000000001', 'suppliera@phukienviet.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('33333333-3333-4333-8333-000000000002', 'supplierb@giadungviet.vn', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE'),
  ('44444444-4444-4444-8444-000000000000', 'customer@gmail.com', '$argon2id$v=19$m=65536,p=1,t=3$uOogXQHsxB8fd25zYy87xg$iZk0EYphT1sdotN5MgFgzVM1CLeOwomiAAAnUg6y/J4', 'ACTIVE')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';

-- =========================================================================================
-- PHẦN 2: PHÂN QUYỀN VAI TRÒ (USER_ROLE_MEMBERSHIPS)
-- =========================================================================================

-- Admin có role ADMIN và CUSTOMER
INSERT INTO user_role_memberships (user_id, role, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'ADMIN', 'ACTIVE'),
  ('11111111-1111-4111-8111-111111111111', 'CUSTOMER', 'ACTIVE'),
  ('11111111-1111-4111-8111-222222222222', 'ADMIN', 'ACTIVE'),
  ('11111111-1111-4111-8111-222222222222', 'CUSTOMER', 'ACTIVE'),
  ('11111111-1111-4111-8111-333333333333', 'ADMIN', 'ACTIVE'),
  ('11111111-1111-4111-8111-333333333333', 'CUSTOMER', 'ACTIVE')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE';

-- Seller có role SELLER và CUSTOMER
INSERT INTO user_role_memberships (user_id, role, status) VALUES
  ('22222222-2222-4222-8222-111111111111', 'SELLER', 'ACTIVE'),
  ('22222222-2222-4222-8222-111111111111', 'CUSTOMER', 'ACTIVE'),
  ('22222222-2222-4222-8222-222222222222', 'SELLER', 'ACTIVE'),
  ('22222222-2222-4222-8222-222222222222', 'CUSTOMER', 'ACTIVE'),
  ('22222222-2222-4222-8222-333333333333', 'SELLER', 'ACTIVE'),
  ('22222222-2222-4222-8222-333333333333', 'CUSTOMER', 'ACTIVE')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE';

-- Supplier có role SUPPLIER và CUSTOMER
INSERT INTO user_role_memberships (user_id, role, status) VALUES
  ('33333333-3333-4333-8333-111111111111', 'SUPPLIER', 'ACTIVE'),
  ('33333333-3333-4333-8333-111111111111', 'CUSTOMER', 'ACTIVE'),
  ('33333333-3333-4333-8333-222222222222', 'SUPPLIER', 'ACTIVE'),
  ('33333333-3333-4333-8333-222222222222', 'CUSTOMER', 'ACTIVE'),
  ('33333333-3333-4333-8333-333333333333', 'SUPPLIER', 'ACTIVE'),
  ('33333333-3333-4333-8333-333333333333', 'CUSTOMER', 'ACTIVE')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE';

-- Customer có role CUSTOMER
INSERT INTO user_role_memberships (user_id, role, status) VALUES
  ('44444444-4444-4444-8444-111111111111', 'CUSTOMER', 'ACTIVE'),
  ('44444444-4444-4444-8444-222222222222', 'CUSTOMER', 'ACTIVE'),
  ('44444444-4444-4444-8444-333333333333', 'CUSTOMER', 'ACTIVE')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE';

-- =========================================================================================
-- PHẦN 3: HỒ SƠ NGƯỜI BÁN (SELLER_PROFILES) & CỬA HÀNG (SHOPS)
-- =========================================================================================

INSERT INTO seller_profiles (id, user_id, display_name, approval_status) VALUES
  ('bbbbbbbb-2222-4222-8222-111111111111', '22222222-2222-4222-8222-111111111111', 'TechZone Official Store', 'APPROVED'),
  ('bbbbbbbb-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'EcoHome Living Store', 'APPROVED'),
  ('bbbbbbbb-2222-4222-8222-333333333333', '22222222-2222-4222-8222-333333333333', 'UrbanStyle Vietnam', 'APPROVED')
ON CONFLICT (user_id) DO UPDATE 
SET display_name = EXCLUDED.display_name, approval_status = 'APPROVED';

INSERT INTO shops (id, seller_id, name, status) VALUES
  ('cccccccc-2222-4222-8222-111111111111', 'bbbbbbbb-2222-4222-8222-111111111111', 'TechZone Official Shop', 'ACTIVE'),
  ('cccccccc-2222-4222-8222-222222222222', 'bbbbbbbb-2222-4222-8222-222222222222', 'EcoHome Living Shop', 'ACTIVE'),
  ('cccccccc-2222-4222-8222-333333333333', 'bbbbbbbb-2222-4222-8222-333333333333', 'UrbanStyle Shop', 'ACTIVE')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, status = 'ACTIVE';

-- =========================================================================================
-- PHẦN 4: HỒ SƠ NHÀ CUNG CẤP (SUPPLIER_PROFILES)
-- =========================================================================================

INSERT INTO supplier_profiles (id, user_id, legal_name, approval_status, payout_account_ref) VALUES
  ('aaaaaaaa-3333-4333-8333-111111111111', '33333333-3333-4333-8333-111111111111', 'Công ty TNHH Phụ Kiện Số Việt Nam', 'APPROVED', 'VCB-001100223344'),
  ('aaaaaaaa-3333-4333-8333-222222222222', '33333333-3333-4333-8333-222222222222', 'Công ty CP Gia Dụng Tiện Ích Việt Đức', 'APPROVED', 'TCB-190388889999'),
  ('aaaaaaaa-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Xưởng Sản Xuất May Mặc An Bình', 'APPROVED', 'MB-098877665544')
ON CONFLICT (user_id) DO UPDATE 
SET legal_name = EXCLUDED.legal_name, approval_status = 'APPROVED', payout_account_ref = EXCLUDED.payout_account_ref;

-- =========================================================================================
-- PHẦN 5: SẢN PHẨM MẪU (PRODUCTS)
-- =========================================================================================

INSERT INTO products (id, supplier_id, supplier_sku, name, description, cost_price, available_stock, status, image_url) VALUES
  -- Phụ kiện công nghệ (Supplier 1)
  ('55555555-5555-4555-8555-111111111111', 'aaaaaaaa-3333-4333-8333-111111111111', 'SP1-BASEUS-GAN65W', 'Củ sạc nhanh 65W GaN 3 cổng Baseus GaN5 Pro', 'Công nghệ GaN5 nhỏ gọn, sạc nhanh cho Laptop và điện thoại, 2 Type-C + 1 USB.', 260000, 150, 'ACTIVE', '/images/charger.jpg'),
  ('55555555-5555-4555-8555-222222222222', 'aaaaaaaa-3333-4333-8333-111111111111', 'SP1-CABLE-100W', 'Cáp sạc Type-C to Type-C 100W bọc dù siêu bền 1.2m', 'Hỗ trợ PD 100W, chip E-Marker an toàn chống cháy nổ, bọc dù chống gãy gập.', 45000, 300, 'ACTIVE', '/images/cable.jpg'),
  ('55555555-5555-4555-8555-333333333333', 'aaaaaaaa-3333-4333-8333-111111111111', 'SP1-BOWIE-E16', 'Tai nghe Bluetooth True Wireless Baseus Bowie E16', 'Âm bass mạnh mẽ, chống nước IPX4, thời lượng pin 30 giờ, độ trễ thấp 0.06s.', 160000, 120, 'ACTIVE', '/images/earbuds.jpg'),
  ('55555555-5555-4555-8555-444444444444', 'aaaaaaaa-3333-4333-8333-111111111111', 'SP1-MOUSE-M330', 'Chuột không dây Silent SilentClick M330 2.4GHz', 'Không gây tiếng ồn, thiết kế công thái học vừa vặn lòng bàn tay, pin 18 tháng.', 120000, 80, 'ACTIVE', '/images/mouse.jpg'),

  -- Gia dụng & Nhà cửa (Supplier 2)
  ('55555555-5555-4555-8555-555555555555', 'aaaaaaaa-3333-4333-8333-222222222222', 'SP2-LOCK-500ML', 'Bình giữ nhiệt Inox 316 Lock&Lock Energetic 500ml', 'Chất liệu Inox 316 cao cấp chống gỉ, giữ nhiệt 12h-24h, nắp mở 1 chạm tiện lợi.', 210000, 100, 'ACTIVE', '/images/bottle.jpg'),
  ('55555555-5555-4555-8555-666666666666', 'aaaaaaaa-3333-4333-8333-222222222222', 'SP2-BLENDER-USB', 'Máy xay sinh tố cầm tay 6 lưỡi dao sạc USB 400ml', 'Dao inox 304 sắc bén, xay nhuyễn đá nhỏ và hoa quả nhanh trong 30 giây.', 135000, 90, 'ACTIVE', '/images/blender.jpg'),
  ('55555555-5555-4555-8555-777777777777', 'aaaaaaaa-3333-4333-8333-222222222222', 'SP2-AIRFRYER-6L', 'Nồi chiên không dầu điện tử điều khiển cảm ứng 6.5L', 'Công suất 1800W, công nghệ Rapid Air giảm 85% mỡ thừa, 8 chế độ tự động.', 790000, 40, 'ACTIVE', '/images/airfryer.jpg'),

  -- May mặc & Balo (Supplier 3)
  ('55555555-5555-4555-8555-888888888888', 'aaaaaaaa-3333-4333-8333-333333333333', 'SP3-BACKPACK-156', 'Balo laptop công sở chống nước đa năng 15.6 inch', 'Vải Oxford cao cấp trượt nước, có cổng sạc USB ngoài, ngăn chống sốc chuyên dụng.', 155000, 150, 'ACTIVE', '/images/backpack.jpg'),
  ('55555555-5555-4555-8555-999999999999', 'aaaaaaaa-3333-4333-8333-333333333333', 'SP3-POLO-COTTON', 'Áo thun nam Polo trơn Cotton Compact thoáng khí', 'Cotton dệt sợi Compact cao cấp, thấm hút mồ hôi, co giãn 4 chiều, không nhăn xù.', 85000, 250, 'ACTIVE', '/images/polo.jpg')
ON CONFLICT (supplier_id, supplier_sku) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, 
    cost_price = EXCLUDED.cost_price, available_stock = EXCLUDED.available_stock, 
    status = 'ACTIVE', image_url = EXCLUDED.image_url;

-- =========================================================================================
-- PHẦN 6: NIÊM YẾT BÁN HÀNG CỦA CÁC SELLER (LISTINGS)
-- =========================================================================================

INSERT INTO listings (id, product_id, shop_id, seller_sku, sale_price, status, visible) VALUES
  -- Seller 1 bán hàng
  ('66666666-6666-4666-8666-111111111111', '55555555-5555-4555-8555-111111111111', 'cccccccc-2222-4222-8222-111111111111', 'TZ-BASEUS-65W', 359000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-222222222222', '55555555-5555-4555-8555-222222222222', 'cccccccc-2222-4222-8222-111111111111', 'TZ-CABLE-100W', 89000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-333333333333', '55555555-5555-4555-8555-333333333333', 'cccccccc-2222-4222-8222-111111111111', 'TZ-BOWIE-E16', 249000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-444444444444', '55555555-5555-4555-8555-555555555555', 'cccccccc-2222-4222-8222-111111111111', 'TZ-LOCK-500ML', 299000, 'ACTIVE', true), -- Cross-listing

  -- Seller 2 bán hàng
  ('66666666-6666-4666-8666-555555555555', '55555555-5555-4555-8555-555555555555', 'cccccccc-2222-4222-8222-222222222222', 'EH-LOCK-500ML', 289000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-666666666666', 'cccccccc-2222-4222-8222-222222222222', 'EH-BLENDER-USB', 219000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-777777777777', '55555555-5555-4555-8555-777777777777', 'cccccccc-2222-4222-8222-222222222222', 'EH-AIRFRYER-6L', 1190000, 'ACTIVE', true),

  -- Seller 3 bán hàng
  ('66666666-6666-4666-8666-888888888888', '55555555-5555-4555-8555-888888888888', 'cccccccc-2222-4222-8222-333333333333', 'US-BACKPACK-156', 279000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-999999999999', '55555555-5555-4555-8555-999999999999', 'cccccccc-2222-4222-8222-333333333333', 'US-POLO-COTTON', 169000, 'ACTIVE', true),
  ('66666666-6666-4666-8666-aaaaaaaaaaaa', '55555555-5555-4555-8555-111111111111', 'cccccccc-2222-4222-8222-333333333333', 'US-BASEUS-65W', 369000, 'ACTIVE', true) -- Cross-listing
ON CONFLICT (shop_id, seller_sku) DO UPDATE 
SET sale_price = EXCLUDED.sale_price, status = 'ACTIVE', visible = true;

-- =========================================================================================
-- PHẦN 7: GIỎ HÀNG MẪU CHO CUSTOMER 1 (CARTS & CART_ITEMS)
-- =========================================================================================

INSERT INTO carts (id, customer_id)
VALUES ('77777777-7777-4777-8777-111111111111', '44444444-4444-4444-8444-111111111111')
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO cart_items (cart_id, listing_id, quantity, last_viewed_unit_sale_price)
VALUES 
  ('77777777-7777-4777-8777-111111111111', '66666666-6666-4666-8666-111111111111', 1, 359000),
  ('77777777-7777-4777-8777-111111111111', '66666666-6666-4666-8666-555555555555', 2, 289000)
ON CONFLICT (cart_id, listing_id) DO UPDATE 
SET quantity = EXCLUDED.quantity, last_viewed_unit_sale_price = EXCLUDED.last_viewed_unit_sale_price;

-- =========================================================================================
-- PHẦN 8: ĐƠN HÀNG MẪU (CUSTOMER_ORDERS & FULFILLMENT_ORDERS)
-- =========================================================================================

-- Đơn mẫu 1: Customer 2 đặt đơn hàng gồm 2 món từ 2 nhà cung cấp khác nhau (Đang giao hàng PROCESSING)
INSERT INTO customer_orders (id, order_no, customer_id, status, fulfillment_summary, currency, grand_total, total_payable, placed_at)
VALUES ('88888888-8888-4888-8888-111111111111', 'DC-ORD-SPLIT-001', '44444444-4444-4444-8444-222222222222', 'PROCESSING', 'PARTIALLY_FULFILLED', 'VND', 608000, 608000, now() - interval '2 days')
ON CONFLICT (id) DO UPDATE 
SET status = 'PROCESSING', fulfillment_summary = 'PARTIALLY_FULFILLED';

INSERT INTO order_items (id, customer_order_id, listing_id, product_name_snapshot, quantity, unit_sale_price_snapshot, unit_cost_price_snapshot)
VALUES 
  ('99999999-9999-4999-8999-111111111111', '88888888-8888-4888-8888-111111111111', '66666666-6666-4666-8666-333333333333', 'Tai nghe Bluetooth True Wireless Baseus Bowie E16', 1, 249000, 160000),
  ('99999999-9999-4999-8999-222222222222', '88888888-8888-4888-8888-111111111111', '66666666-6666-4666-8666-111111111111', 'Củ sạc nhanh 65W GaN 3 cổng Baseus GaN5 Pro', 1, 359000, 260000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fulfillment_orders (id, fulfillment_no, customer_order_id, supplier_id, seller_id, status, tracking_no, currency)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-111111111111', 'FO-001-SUP1', '88888888-8888-4888-8888-111111111111', 'aaaaaaaa-3333-4333-8333-111111111111', 'bbbbbbbb-2222-4222-8222-111111111111', 'ACCEPTED', 'VNPOST-888999', 'VND')
ON CONFLICT (id) DO UPDATE SET status = 'ACCEPTED';

-- Đơn mẫu 2: Customer 3 đặt đơn COD, đã hoàn thành FULFILLED
INSERT INTO customer_orders (id, order_no, customer_id, status, fulfillment_summary, currency, grand_total, total_payable, placed_at)
VALUES ('88888888-8888-4888-8888-222222222222', 'DC-ORD-COD-DELIVERED', '44444444-4444-4444-8444-333333333333', 'CONFIRMED', 'FULFILLED', 'VND', 279000, 279000, now() - interval '5 days')
ON CONFLICT (id) DO UPDATE 
SET status = 'CONFIRMED', fulfillment_summary = 'FULFILLED';

INSERT INTO order_items (id, customer_order_id, listing_id, product_name_snapshot, quantity, unit_sale_price_snapshot, unit_cost_price_snapshot)
VALUES ('99999999-9999-4999-8999-333333333333', '88888888-8888-4888-8888-222222222222', '66666666-6666-4666-8666-888888888888', 'Balo laptop công sở chống nước đa năng 15.6 inch', 1, 279000, 155000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fulfillment_orders (id, fulfillment_no, customer_order_id, supplier_id, seller_id, status, tracking_no, currency)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-222222222222', 'FO-002-DELIVERED', '88888888-8888-4888-8888-222222222222', 'aaaaaaaa-3333-4333-8333-333333333333', 'bbbbbbbb-2222-4222-8222-333333333333', 'DELIVERED', 'GHN-99887766', 'VND')
ON CONFLICT (id) DO UPDATE SET status = 'DELIVERED';

COMMIT;
