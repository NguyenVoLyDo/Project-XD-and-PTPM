-- Additive migration for the integrated Person 1/2/3 runtime; no data reset.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS last_viewed_unit_sale_price bigint;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS snapshot jsonb;
CREATE TABLE IF NOT EXISTS processed_order_events (
  event_id uuid PRIMARY KEY, event_type text NOT NULL, aggregate_id uuid NOT NULL,
  processed_at timestamptz NOT NULL, source_ref text, reason_code text
);
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id),
  source_ref text NOT NULL, delta integer NOT NULL, reason_code text NOT NULL,
  result jsonb NOT NULL, UNIQUE(product_id, source_ref)
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_reservation_order_item_unique ON stock_reservations(order_item_id);
-- Orders allocates IDs before writing the parent; all references are verified at commit.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname, conrelid::regclass AS tbl FROM pg_constraint
    WHERE contype='f' AND conrelid IN ('stock_reservations'::regclass, 'payment_intents'::regclass,
      'payments'::regclass, 'payment_allocations'::regclass, 'fulfillment_orders'::regclass)
  LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED', r.tbl, r.conname); END LOOP;
END $$;
