-- Create AI settings table
CREATE TABLE IF NOT EXISTS ai_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default AI settings
INSERT INTO ai_settings (setting_key, setting_value, description) VALUES
    ('low_stock_threshold', '5', 'Default low stock threshold'),
    ('duplicate_similarity_threshold', '0.85', 'Similarity threshold for duplicate detection (0-1)'),
    ('enable_ai_duplicate_check', 'true', 'Enable duplicate checking during product creation'),
    ('enable_low_stock_alerts', 'true', 'Enable low stock alerts'),
    ('ai_cache_ttl_minutes', '5', 'Cache TTL for AI queries in minutes');

-- Create index for faster lookups
CREATE INDEX idx_ai_settings_key ON ai_settings(setting_key);