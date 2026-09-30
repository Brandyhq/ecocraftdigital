-- PayPlus payments, coupons and newsletter subscribers.
ALTER TABLE orders ADD COLUMN order_ref TEXT;                       -- random public reference used in PayPlus URLs
CREATE UNIQUE INDEX idx_orders_order_ref ON orders(order_ref);
ALTER TABLE orders ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN payplus_transaction_uid TEXT;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE coupons (
  code TEXT PRIMARY KEY,                                            -- stored upper-case
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value REAL NOT NULL CHECK (value > 0),
  active INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER,                                                 -- NULL = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Welcome coupons (15%, single use) are created per subscriber by /api/subscribe.

CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'footer',
  consent INTEGER NOT NULL DEFAULT 0,
  discount_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
