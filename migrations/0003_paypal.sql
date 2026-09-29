-- Automatic PayPal payments: link our orders to PayPal orders/captures.
ALTER TABLE orders ADD COLUMN paypal_order_id TEXT;
ALTER TABLE orders ADD COLUMN paypal_capture_id TEXT;
CREATE UNIQUE INDEX idx_orders_paypal_order_id ON orders(paypal_order_id);
