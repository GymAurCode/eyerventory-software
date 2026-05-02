-- Safely add columns to products that may be missing in older DBs
ALTER TABLE products ADD COLUMN image_data TEXT;
ALTER TABLE products ADD COLUMN image_mime VARCHAR(32);
ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0;
