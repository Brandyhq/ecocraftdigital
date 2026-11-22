-- Commerce stage 3: the checkout collects consent, so it has to be stored with the order (ECOMMERCE_SPEC.md, section 5).
ALTER TABLE orders ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE orders ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN marketing_consent_at TEXT;
