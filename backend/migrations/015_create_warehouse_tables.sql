-- Warehouse Management Tables

CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(120) NOT NULL UNIQUE,
    code VARCHAR(20) UNIQUE,
    location VARCHAR(255),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouse_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS ix_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_warehouse_stock_product ON warehouse_stock(product_id);

CREATE TABLE IF NOT EXISTS stock_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    transaction_type VARCHAR(20) NOT NULL,
    reference_type VARCHAR(40),
    reference_id INTEGER,
    quantity INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    unit_price FLOAT,
    total_amount FLOAT,
    description VARCHAR(255),
    created_by VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_stock_ledger_product ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_warehouse ON stock_ledger(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_type ON stock_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_date ON stock_ledger(created_at);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_no VARCHAR(30) NOT NULL UNIQUE,
    transaction_type VARCHAR(20) NOT NULL,
    source_warehouse_id INTEGER REFERENCES warehouses(id),
    dest_warehouse_id INTEGER REFERENCES warehouses(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    reference_no VARCHAR(80),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_by VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_stock_transactions_type ON stock_transactions(transaction_type);

CREATE TABLE IF NOT EXISTS stock_transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES stock_transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price FLOAT,
    total_price FLOAT,
    batch_no VARCHAR(40),
    notes VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_stock_txn_items_transaction ON stock_transaction_items(transaction_id);

CREATE TABLE IF NOT EXISTS damage_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity INTEGER NOT NULL,
    reason VARCHAR(255),
    reported_by VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    count_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle_count_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_count_id INTEGER NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    system_qty INTEGER NOT NULL,
    counted_qty INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    notes VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS closing_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    date DATETIME NOT NULL,
    opening_qty INTEGER NOT NULL,
    inward_qty INTEGER NOT NULL DEFAULT 0,
    outward_qty INTEGER NOT NULL DEFAULT 0,
    closing_qty INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_closing_stock_date ON closing_stock(date);
CREATE INDEX IF NOT EXISTS ix_closing_stock_product ON closing_stock(product_id);
CREATE INDEX IF NOT EXISTS ix_closing_stock_warehouse ON closing_stock(warehouse_id);

-- Seed default warehouse
INSERT OR IGNORE INTO warehouses (name, code) VALUES ('Main Warehouse', 'MAIN');
