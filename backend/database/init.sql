-- DropConnect local development/test database reset.
-- WARNING: this permanently deletes the existing dropconnect database and all data.
-- Replace change-me before running. Requires a PostgreSQL administrator account.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dropconnect') THEN
    CREATE ROLE dropconnect LOGIN PASSWORD 'change-me';
  END IF;
END
$$;
ALTER ROLE dropconnect WITH LOGIN PASSWORD 'change-me';

DROP DATABASE IF EXISTS dropconnect WITH (FORCE);
CREATE DATABASE dropconnect OWNER dropconnect;
\connect dropconnect

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_role_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE TABLE supplier_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  legal_name varchar(255) NOT NULL,
  approval_status varchar(32) NOT NULL DEFAULT 'PENDING',
  payout_account_ref varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  display_name varchar(255) NOT NULL,
  approval_status varchar(32) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES supplier_profiles(id) ON DELETE RESTRICT,
  supplier_sku varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  cost_price numeric(14,2) NOT NULL CHECK (cost_price >= 0),
  available_stock integer NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
  status varchar(32) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku)
);
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  seller_sku varchar(100),
  sale_price numeric(14,2) NOT NULL CHECK (sale_price >= 0),
  status varchar(32) NOT NULL DEFAULT 'DRAFT',
  visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, seller_sku)
);
CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, listing_id)
);
CREATE TABLE customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no varchar(40) NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
  fulfillment_summary varchar(32) NOT NULL DEFAULT 'UNFULFILLED',
  currency char(3) NOT NULL DEFAULT 'VND',
  grand_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  total_payable numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_payable >= 0),
  placed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  product_name_snapshot varchar(255) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_sale_price_snapshot numeric(14,2) NOT NULL CHECK (unit_sale_price_snapshot >= 0),
  unit_cost_price_snapshot numeric(14,2) NOT NULL CHECK (unit_cost_price_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fulfillment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_no varchar(40) NOT NULL UNIQUE,
  customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES supplier_profiles(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  tracking_no varchar(100),
  currency char(3) NOT NULL DEFAULT 'VND',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_order_id, supplier_id, seller_id)
);
CREATE TABLE fulfillment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_order_id uuid NOT NULL REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  item_gross_snapshot numeric(14,2) NOT NULL CHECK (item_gross_snapshot >= 0),
  UNIQUE (fulfillment_order_id, order_item_id)
);
CREATE TABLE stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  status varchar(32) NOT NULL DEFAULT 'HELD',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
  provider varchar(64) NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'VND',
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  idempotency_key varchar(255) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  provider_transaction_ref varchar(255) UNIQUE,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
  payment_intent_id uuid REFERENCES payment_intents(id) ON DELETE RESTRICT,
  method varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  provider_transaction_ref varchar(255) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  fulfillment_order_id uuid NOT NULL REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  merchandise_amount numeric(14,2) NOT NULL DEFAULT 0,
  shipping_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_to_collect numeric(14,2) NOT NULL CHECK (amount_to_collect >= 0),
  currency char(3) NOT NULL DEFAULT 'VND',
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, fulfillment_order_id)
);
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_allocation_id uuid NOT NULL REFERENCES payment_allocations(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  reason_code varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_order_id uuid NOT NULL UNIQUE REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  carrier_code varchar(64) NOT NULL,
  tracking_no varchar(100) NOT NULL UNIQUE,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_order_id uuid NOT NULL UNIQUE REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  seller_earning numeric(14,2) NOT NULL DEFAULT 0,
  supplier_payable numeric(14,2) NOT NULL DEFAULT 0,
  platform_fee numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'VND',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
  type varchar(64) NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'VND',
  source_ref varchar(255) NOT NULL UNIQUE,
  posted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, product_id)
);
CREATE TABLE provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(64) NOT NULL,
  provider_event_id varchar(255) NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  key varchar(255) NOT NULL,
  request_hash varchar(128),
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, key)
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(64) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(128) NOT NULL,
  entity_type varchar(64) NOT NULL,
  entity_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_listings_product_id ON listings(product_id);
CREATE INDEX idx_orders_customer_id ON customer_orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(customer_order_id);
CREATE INDEX idx_fulfillment_orders_order_id ON fulfillment_orders(customer_order_id);
CREATE INDEX idx_payment_intents_order_id ON payment_intents(customer_order_id);
CREATE INDEX idx_outbox_events_unpublished ON outbox_events(published_at) WHERE published_at IS NULL;