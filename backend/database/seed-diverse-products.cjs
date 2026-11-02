const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const env = parseEnv(fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8'));

(async () => {
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await client.connect();

  // Update existing products with image_url if null
  await client.query("UPDATE products SET image_url='/images/charger.jpg' WHERE image_url IS NULL");

  // Get first approved supplier and seller to create the other 2 popular products if not exist
  const supp = await client.query("SELECT id FROM supplier_profiles WHERE approval_status='APPROVED' LIMIT 1");
  const sell = await client.query("SELECT s.id AS shop_id FROM shops s JOIN seller_profiles sp ON sp.id=s.seller_id WHERE s.status='ACTIVE' LIMIT 1");

  if (supp.rows.length && sell.rows.length) {
    const supplierId = supp.rows[0].id;
    const shopId = sell.rows[0].shop_id;

    // 1. Tai nghe Baseus
    const p1 = await client.query(`
      INSERT INTO products (supplier_id, supplier_sku, name, description, cost_price, available_stock, status, image_url)
      VALUES ($1, 'BASEUS-E16-LIVE', 'Tai nghe Bluetooth True Wireless Baseus Bowie E16', 'Âm bass mạnh mẽ, chống nước IPX4, thời lượng pin 30 giờ.', 150000, 50, 'ACTIVE', '/images/earbuds.jpg')
      ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET image_url='/images/earbuds.jpg'
      RETURNING id
    `, [supplierId]);

    await client.query(`
      INSERT INTO listings (product_id, shop_id, seller_sku, sale_price, status, visible)
      VALUES ($1, $2, 'SELL-BASEUS-E16', 249000, 'ACTIVE', true)
      ON CONFLICT (shop_id, seller_sku) DO UPDATE SET sale_price=249000, status='ACTIVE', visible=true
    `, [p1.rows[0].id, shopId]);

    // 2. Bình giữ nhiệt Lock&Lock
    const p2 = await client.query(`
      INSERT INTO products (supplier_id, supplier_sku, name, description, cost_price, available_stock, status, image_url)
      VALUES ($1, 'LOCK-500ML-LIVE', 'Bình giữ nhiệt Lock&Lock Energetic One-Touch 500ml', 'Inox 316 cao cấp, giữ nhiệt 8-24 giờ, nắp mở 1 chạm tiện lợi.', 220000, 40, 'ACTIVE', '/images/bottle.jpg')
      ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET image_url='/images/bottle.jpg'
      RETURNING id
    `, [supplierId]);

    await client.query(`
      INSERT INTO listings (product_id, shop_id, seller_sku, sale_price, status, visible)
      VALUES ($1, $2, 'SELL-LOCK-500ML', 349000, 'ACTIVE', true)
      ON CONFLICT (shop_id, seller_sku) DO UPDATE SET sale_price=349000, status='ACTIVE', visible=true
    `, [p2.rows[0].id, shopId]);
  }

  console.log('Diverse products and images updated successfully in PostgreSQL!');
  await client.end();
})().catch(console.error);
