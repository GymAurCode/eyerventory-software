-- Safely add HR columns that may be missing in older DBs
ALTER TABLE employees ADD COLUMN grace_minutes INTEGER DEFAULT 10;
ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT 1;
ALTER TABLE attendance_logs ADD COLUMN late_minutes INTEGER DEFAULT 0;
ALTER TABLE hr_payments ADD COLUMN is_reversed INTEGER DEFAULT 0;
ALTER TABLE hr_payments ADD COLUMN payroll_id INTEGER;
