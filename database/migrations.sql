-- database/migrations.sql
-- Create loyalty_transactions table to log earn, redeem, and refund actions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_account_id UUID REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for earns/refund-returns, negative for redemptions/refund-deductions
    transaction_type VARCHAR(50) NOT NULL, -- 'EARN', 'REDEEM', 'REFUND_DEDUCT', 'REFUND_RETURN'
    reference_id VARCHAR(100), -- Order UUID or Payment UUID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(loyalty_account_id);

-- Add status field to loyalty_accounts
ALTER TABLE loyalty_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE'; -- 'ACTIVE', 'FROZEN'

-- Add low-stock and sold-out tracking timestamps to dishes
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS low_stock_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sold_out_at TIMESTAMP WITH TIME ZONE;

-- Create audit_logs table to track changes in payments and encrypted personal data (users table)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    record_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger function to automatically log changes
CREATE OR REPLACE FUNCTION audit_log_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB := NULL;
    new_data JSONB := NULL;
    rec_id VARCHAR(100);
BEGIN
    IF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        rec_id := CAST(OLD.id AS VARCHAR);
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
        rec_id := CAST(NEW.id AS VARCHAR);
    ELSIF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        rec_id := CAST(OLD.id AS VARCHAR);
    END IF;

    -- Strip sensitive encrypted binary fields from logs to keep them secure
    IF old_data ? 'full_name' THEN old_data := old_data - 'full_name' - 'password_hash'; END IF;
    IF new_data ? 'full_name' THEN new_data := new_data - 'full_name' - 'password_hash'; END IF;
    IF old_data ? 'phone_number' THEN old_data := old_data - 'phone_number'; END IF;
    IF new_data ? 'phone_number' THEN new_data := new_data - 'phone_number'; END IF;

    INSERT INTO audit_logs (table_name, action, record_id, old_values, new_values, changed_at)
    VALUES (TG_TABLE_NAME, TG_OP, rec_id, old_data, new_data, CURRENT_TIMESTAMP);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind triggers to users (personal data) and payments tables
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_func();

DROP TRIGGER IF EXISTS audit_payments_trigger ON payments;
CREATE TRIGGER audit_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_func();

-- Add points_redeemed column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

