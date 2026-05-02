-- Sales and Purchases tables
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    selling_price REAL NOT NULL,
    revenue REAL NOT NULL,
    cost REAL NOT NULL,
    profit REAL NOT NULL,
    payment_type VARCHAR(10) NOT NULL DEFAULT 'cash',
    customer_id INTEGER REFERENCES customers(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    payment_type VARCHAR(10) NOT NULL DEFAULT 'cash',
    total_amount REAL NOT NULL DEFAULT 0.0,
    note VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL
);
