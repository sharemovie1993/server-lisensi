PRAGMA foreign_keys = OFF;
UPDATE products SET id='platform-absenta', name='platform-absenta', display_name='Platform-Absenta', key_prefix='ABS' WHERE id='absenta';
DELETE FROM pricing_plans WHERE product_id='absenta' OR product_id='platform-absenta';
INSERT INTO pricing_plans (id, product_id, title, price, device_limit, duration) VALUES ('absenta_on_premise', 'platform-absenta', 'On Premise', 'Rp 0', 9999, '365');
INSERT INTO pricing_plans (id, product_id, title, price, device_limit, duration) VALUES ('absenta_cloud', 'platform-absenta', 'Cloud', 'Rp 0', 9999, '365');
UPDATE licenses SET product_id='platform-absenta' WHERE product_id='absenta';
UPDATE subscriptions SET product_id='platform-absenta' WHERE product_id='absenta';
UPDATE invoices SET product_id='platform-absenta' WHERE product_id='absenta';
PRAGMA foreign_keys = ON;
