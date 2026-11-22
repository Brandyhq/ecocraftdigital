-- Commerce stage 2 (ECOMMERCE_SPEC.md): the catalog is priced in whole agorot, products can carry an
-- access link (service or game opened after payment), and delivery files get their own table (R2 keys).
-- products.price / old_price (REAL, shekels) stay for legacy readers; the back office writes both from one value.
ALTER TABLE products ADD COLUMN price_agorot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN old_price_agorot INTEGER;
ALTER TABLE products ADD COLUMN access_url TEXT NOT NULL DEFAULT '';   -- private: shown only to paying customers

UPDATE products SET
  price_agorot = CAST(ROUND(price * 100) AS INTEGER),
  old_price_agorot = CASE WHEN old_price IS NULL THEN NULL ELSE CAST(ROUND(old_price * 100) AS INTEGER) END;

-- Stage 4 must snapshot a paid order's files, because deleting a product removes its rows here.
CREATE TABLE product_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,                         -- object key in the private R2 bucket; never sent to the storefront
  label_he TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_files_product ON product_files(product_id, sort);
