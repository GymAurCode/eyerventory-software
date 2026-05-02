-- Safely add columns to users that may be missing in older DBs
-- SQLite does not support IF NOT EXISTS on ALTER TABLE,
-- so the migration runner handles OperationalError gracefully.
ALTER TABLE users ADD COLUMN name VARCHAR(120);
ALTER TABLE users ADD COLUMN email VARCHAR(120);
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
