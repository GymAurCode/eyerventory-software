-- Add SKU, category, and selling_price to products for bulk import support
ALTER TABLE products ADD COLUMN sku VARCHAR(60);
ALTER TABLE products ADD COLUMN category VARCHAR(60);
ALTER TABLE products ADD COLUMN selling_price REAL NOT NULL DEFAULT 0.0;
