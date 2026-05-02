-- Add missing balance columns (older DBs may not have them)
-- Safe to run multiple times: migration runner ignores "duplicate column name" errors.

ALTER TABLE suppliers ADD COLUMN balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN balance REAL NOT NULL DEFAULT 0.0;

