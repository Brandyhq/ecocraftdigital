-- Back office schema.
--
-- The legacy `products` / `order_items` tables (integer ids, free-text categories) are
-- kept as `legacy_*` so no historic data is lost; new code uses the tables below.
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_active;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
ALTER TABLE order_items RENAME TO legacy_order_items;
ALTER TABLE products RENAME TO legacy_products;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  includes TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  price REAL NOT NULL CHECK (price >= 0),
  old_price REAL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  tag TEXT NOT NULL DEFAULT '',
  tag_type TEXT NOT NULL DEFAULT 'rose',
  rating REAL NOT NULL DEFAULT 5,
  reviews INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  cover_title TEXT NOT NULL DEFAULT '',
  cover_sub TEXT NOT NULL DEFAULT '',
  cover_from TEXT NOT NULL DEFAULT '',
  cover_to TEXT NOT NULL DEFAULT '',
  paypal_url TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',             -- external download link (private; never sent to the storefront)
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active, sort_order);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,                    -- snapshot: survives product edits/deletes
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price REAL NOT NULL,
  -- delivery snapshot, filled when the product is deleted so paid orders can still be fulfilled
  file_url TEXT NOT NULL DEFAULT '',
  file_id TEXT
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- orders: paid/delivered timestamps, notes, and an unguessable token for customer downloads
ALTER TABLE orders ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN paid_at DATETIME;
ALTER TABLE orders ADD COLUMN delivered_at DATETIME;
ALTER TABLE orders ADD COLUMN download_token TEXT;
CREATE UNIQUE INDEX idx_orders_download_token ON orders(download_token);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- private digital files (D1 rows are limited to ~2MB; larger files should use an external link)
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- public images uploaded from the back office
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- site design / content, stored as JSON documents keyed by name
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL                    -- unix seconds
);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip, created_at);

-- Carry existing data over. Legacy products come in HIDDEN (active = 0): they were sample/legacy
-- catalog entries, and the admin can re-enable any of them. Ids are preserved so order lines still match.
-- (Only columns guaranteed by 0001 are read; legacy image/file links stay in legacy_products.)
INSERT OR IGNORE INTO categories (id, name, sort_order)
  SELECT 'legacy-' || lower(hex(category)), category, 100
  FROM (SELECT DISTINCT category FROM legacy_products WHERE category IS NOT NULL AND category != '');
INSERT INTO products (id, slug, name, description, price, category_id, active, sort_order)
  SELECT id, 'legacy-' || id, name, COALESCE(description, ''), price,
         CASE WHEN category IS NULL OR category = '' THEN NULL ELSE 'legacy-' || lower(hex(category)) END, 0, 1000 + id
  FROM legacy_products;
INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
  SELECT loi.order_id, loi.product_id, lp.name, loi.quantity, loi.price
  FROM legacy_order_items loi JOIN legacy_products lp ON lp.id = loi.product_id;
-- Orders already marked paid in the old panel keep that state and get a personal download token.
UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, created_at), download_token = lower(hex(randomblob(24)))
  WHERE payment_status = 'paid' AND status NOT IN ('cancelled', 'refunded');

-- SECURITY: seed.sql used to ship a default admin ('admin' / 'admin123'). Remove it if present.
DELETE FROM admin_users WHERE password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
