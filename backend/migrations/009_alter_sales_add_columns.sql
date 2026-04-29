-- Safely add credit-sale columns to sales that may be missing in older DBs
ALTER TABLE sales ADD COLUMN payment_type VARCHAR(10) DEFAULT 'cash';
ALTER TABLE sales ADD COLUMN customer_id INTEGER;
