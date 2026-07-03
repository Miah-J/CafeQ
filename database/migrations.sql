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

-- Add category column to dishes
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Meals';

-- Add failure_reason column to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(255);

-- Update existing dishes to assign some category data for analytics variety
UPDATE dishes SET category = 'Beverages' WHERE name ILIKE '%tea%' OR name ILIKE '%coffee%' OR name ILIKE '%soda%' OR name ILIKE '%juice%' OR name ILIKE '%drink%' OR name ILIKE '%water%';
UPDATE dishes SET category = 'Snacks' WHERE name ILIKE '%samosa%' OR name ILIKE '%fruit%' OR name ILIKE '%mandazi%' OR name ILIKE '%chapati%' OR name ILIKE '%salad%';

-- Create academic_events table
CREATE TABLE IF NOT EXISTS academic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- EXAM_WEEK, SEMESTER_BREAK
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial ranges for testing correlation
INSERT INTO academic_events (name, event_type, start_date, end_date)
SELECT 'Semester Break', 'SEMESTER_BREAK', '2026-06-15', '2026-06-22'
WHERE NOT EXISTS (SELECT 1 FROM academic_events WHERE name = 'Semester Break');

INSERT INTO academic_events (name, event_type, start_date, end_date)
SELECT 'Exam Week', 'EXAM_WEEK', '2026-06-25', '2026-07-02'
WHERE NOT EXISTS (SELECT 1 FROM academic_events WHERE name = 'Exam Week');



