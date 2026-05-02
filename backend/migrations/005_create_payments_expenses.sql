-- Payments and Expenses tables
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    direction VARCHAR(10) NOT NULL,  -- 'receive' | 'pay'
    method VARCHAR(20) NOT NULL DEFAULT 'cash',
    note VARCHAR(255),
    customer_id INTEGER REFERENCES customers(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description VARCHAR(255) NOT NULL,
    amount REAL NOT NULL,
    category VARCHAR(60),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
