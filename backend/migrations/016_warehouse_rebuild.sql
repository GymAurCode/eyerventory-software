-- Warehouse Module Rebuild — Extend existing tables + Create new tables
-- Part of the Distributor Management System rebuild

-- =====================================================================
-- 1. EXTEND EXISTING TABLES
-- =====================================================================

ALTER TABLE warehouses ADD COLUMN manager_id INTEGER REFERENCES employees(id);
ALTER TABLE warehouses ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE warehouses ADD COLUMN allow_negative_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN coa_mode VARCHAR(20) NOT NULL DEFAULT 'separate';

-- =====================================================================
-- 2. OPENING STOCK
-- =====================================================================

CREATE TABLE IF NOT EXISTS opening_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 0,
    rate FLOAT NOT NULL DEFAULT 0,
    value FLOAT NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS ix_opening_stock_warehouse ON opening_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_opening_stock_product ON opening_stock(product_id);

-- =====================================================================
-- 3. AREAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    salesman_id INTEGER REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS ix_areas_salesman ON areas(salesman_id);

-- =====================================================================
-- 4. SHOPS
-- =====================================================================

CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(120) NOT NULL,
    owner_name VARCHAR(120),
    phone VARCHAR(20),
    address VARCHAR(255),
    area_id INTEGER REFERENCES areas(id),
    salesman_id INTEGER REFERENCES employees(id),
    credit_limit FLOAT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_shops_salesman ON shops(salesman_id);
CREATE INDEX IF NOT EXISTS ix_shops_area ON shops(area_id);
CREATE INDEX IF NOT EXISTS ix_shops_status ON shops(status);

-- =====================================================================
-- 5. SALESMEN WAREHOUSE LINK
-- =====================================================================

CREATE TABLE IF NOT EXISTS salesmen_warehouse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    areas TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE(salesman_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS ix_salesmen_warehouse_salesman ON salesmen_warehouse(salesman_id);
CREATE INDEX IF NOT EXISTS ix_salesmen_warehouse_warehouse ON salesmen_warehouse(warehouse_id);

-- =====================================================================
-- 6. STOCK MOVEMENTS (unified audit log)
-- =====================================================================

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(30) NOT NULL,
    qty INTEGER NOT NULL,
    rate FLOAT,
    value FLOAT,
    reference_id INTEGER,
    reference_type VARCHAR(40),
    salesman_id INTEGER REFERENCES employees(id),
    shop_id INTEGER REFERENCES shops(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    notes TEXT,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS ix_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS ix_stock_movements_date ON stock_movements(date);

-- =====================================================================
-- 7. INVOICES
-- =====================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no VARCHAR(30) NOT NULL UNIQUE,
    date DATE NOT NULL,
    salesman_id INTEGER NOT NULL REFERENCES employees(id),
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    gross_total FLOAT NOT NULL DEFAULT 0,
    discount FLOAT NOT NULL DEFAULT 0,
    net_total FLOAT NOT NULL DEFAULT 0,
    paid_amount FLOAT NOT NULL DEFAULT 0,
    balance_amount FLOAT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
);

CREATE INDEX IF NOT EXISTS ix_invoices_shop ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS ix_invoices_salesman ON invoices(salesman_id);
CREATE INDEX IF NOT EXISTS ix_invoices_warehouse ON invoices(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS ix_invoices_date ON invoices(date);

-- =====================================================================
-- 8. INVOICE ITEMS
-- =====================================================================

CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty INTEGER NOT NULL,
    rate FLOAT NOT NULL DEFAULT 0,
    amount FLOAT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_invoice_items_invoice ON invoice_items(invoice_id);

-- =====================================================================
-- 9. SHOP PAYMENTS (collections from shops)
-- =====================================================================

CREATE TABLE IF NOT EXISTS shop_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    invoice_id INTEGER REFERENCES invoices(id),
    date DATE NOT NULL,
    amount FLOAT NOT NULL,
    payment_mode VARCHAR(30) NOT NULL DEFAULT 'cash',
    reference VARCHAR(80),
    notes TEXT,
    salesman_id INTEGER REFERENCES employees(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_shop_payments_shop ON shop_payments(shop_id);
CREATE INDEX IF NOT EXISTS ix_shop_payments_invoice ON shop_payments(invoice_id);
CREATE INDEX IF NOT EXISTS ix_shop_payments_salesman ON shop_payments(salesman_id);

-- =====================================================================
-- 10. RETURNS
-- =====================================================================

CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_type VARCHAR(20) NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    salesman_id INTEGER REFERENCES employees(id),
    shop_id INTEGER REFERENCES shops(id),
    invoice_id INTEGER REFERENCES invoices(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty INTEGER NOT NULL,
    rate FLOAT,
    reason TEXT,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_returns_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS ix_returns_warehouse ON returns(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_returns_salesman ON returns(salesman_id);
CREATE INDEX IF NOT EXISTS ix_returns_shop ON returns(shop_id);
CREATE INDEX IF NOT EXISTS ix_returns_invoice ON returns(invoice_id);

-- =====================================================================
-- 11. WAREHOUSE COA ACCOUNTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS warehouse_coa_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    account_name VARCHAR(120) NOT NULL,
    account_type VARCHAR(30) NOT NULL,
    account_code VARCHAR(20),
    is_linked_to_main_coa INTEGER NOT NULL DEFAULT 0,
    UNIQUE(warehouse_id, account_name)
);

CREATE INDEX IF NOT EXISTS ix_warehouse_coa_warehouse ON warehouse_coa_accounts(warehouse_id);

-- =====================================================================
-- 12. WAREHOUSE JOURNAL ENTRIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS warehouse_journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reference VARCHAR(80),
    narration TEXT,
    posted_to_main INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_wh_journal_wh ON warehouse_journal_entries(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_wh_journal_date ON warehouse_journal_entries(date);
CREATE INDEX IF NOT EXISTS ix_wh_journal_posted ON warehouse_journal_entries(posted_to_main);

-- =====================================================================
-- 13. WAREHOUSE JOURNAL LINES
-- =====================================================================

CREATE TABLE IF NOT EXISTS warehouse_journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_id INTEGER NOT NULL REFERENCES warehouse_journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES warehouse_coa_accounts(id),
    debit FLOAT NOT NULL DEFAULT 0,
    credit FLOAT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_wh_journal_lines_journal ON warehouse_journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS ix_wh_journal_lines_account ON warehouse_journal_lines(account_id);

-- =====================================================================
-- 14. COA SETTINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS coa_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL DEFAULT 'separate',
    linked_main_coa_accounts TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(warehouse_id)
);

CREATE INDEX IF NOT EXISTS ix_coa_settings_warehouse ON coa_settings(warehouse_id);
