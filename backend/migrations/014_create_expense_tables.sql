-- Expense Module v2: multi-item expenses with accounting integration
ALTER TABLE expenses ADD COLUMN voucher_no VARCHAR(20);
ALTER TABLE expenses ADD COLUMN employee_name VARCHAR(120);
ALTER TABLE expenses ADD COLUMN remarks TEXT;
ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN reimbursement_pending BOOLEAN DEFAULT 0;
ALTER TABLE expenses ADD COLUMN total_amount REAL NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS ix_expenses_voucher_no ON expenses(voucher_no) WHERE voucher_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS expense_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    expense_type VARCHAR(40) NOT NULL,
    description VARCHAR(255),
    amount REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_expense_items_expense ON expense_items(expense_id);

CREATE TABLE IF NOT EXISTS expense_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    vehicle_name VARCHAR(120) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    driver_name VARCHAR(120),
    trip_purpose VARCHAR(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_expense_vehicles_expense ON expense_vehicles(expense_id);

-- Add expense-type mapped GL accounts to chart of accounts
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Fuel & Conveyance Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Vehicle Maintenance Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Conveyance Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Labour Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Meals & Entertainment Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Office Supplies Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Utilities Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Rent Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Salary Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Repair & Maintenance Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Miscellaneous Expense', 'expense');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Employee Payable Account', 'liability');
INSERT OR IGNORE INTO accounts (name, type) VALUES ('Petty Cash Account', 'asset');
