-- REAL-TIME PAYPAL BALANCE DEBUGGING
-- This script will help us trace exactly what's happening with wallet updates

-- 1. First, create a detailed audit table to track all wallet balance changes
CREATE TABLE IF NOT EXISTS wallet_balance_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    old_balance NUMERIC,
    new_balance NUMERIC,
    change_amount NUMERIC,
    change_source TEXT NOT NULL, -- 'trigger', 'function', 'direct_update', etc.
    transaction_id UUID,
    transaction_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stack_trace TEXT
);

-- 2. Create a comprehensive trigger to log ALL wallet balance changes
CREATE OR REPLACE FUNCTION audit_wallet_balance_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the change with stack trace
    INSERT INTO wallet_balance_audit (
        user_id, 
        old_balance, 
        new_balance, 
        change_amount, 
        change_source,
        stack_trace
    ) VALUES (
        NEW.id,
        OLD.wallet_balance,
        NEW.wallet_balance,
        NEW.wallet_balance - COALESCE(OLD.wallet_balance, 0),
        'direct_users_table_update',
        current_setting('application_name', true) || ' - ' || 
        current_setting('client_addr', true) || ' - ' ||
        pg_backend_pid()::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table to catch ALL wallet balance changes
DROP TRIGGER IF EXISTS audit_wallet_balance_trigger ON users;
CREATE TRIGGER audit_wallet_balance_trigger
    AFTER UPDATE OF wallet_balance ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_wallet_balance_changes();

-- 3. Enhanced version of the wallet transaction trigger with detailed logging
CREATE OR REPLACE FUNCTION update_wallet_balance_with_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if the payment status changed from non-completed to completed
    IF OLD.payment_status != 'completed' AND NEW.payment_status = 'completed' THEN
        -- Log trigger execution
        INSERT INTO wallet_balance_audit (
            user_id,
            old_balance,
            new_balance,
            change_amount,
            change_source,
            transaction_id,
            transaction_status
        ) VALUES (
            NEW.user_id,
            (SELECT wallet_balance FROM users WHERE id = NEW.user_id),
            (SELECT wallet_balance FROM users WHERE id = NEW.user_id) + NEW.amount,
            NEW.amount,
            'wallet_transaction_trigger',
            NEW.id,
            NEW.payment_status
        );
        
        -- Update wallet balance
        IF NEW.type = 'top_up' THEN
            UPDATE users 
            SET wallet_balance = COALESCE(wallet_balance, 0) + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS update_wallet_balance_trigger_safe ON wallet_transactions;
CREATE TRIGGER update_wallet_balance_trigger_with_audit
    AFTER UPDATE OF payment_status ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_balance_with_audit();

-- 4. Query to check what's happening in real-time
-- Run this AFTER a PayPal transaction to see all balance changes
SELECT 
    'WALLET BALANCE AUDIT' as report_type,
    wba.id,
    wba.user_id,
    wba.old_balance,
    wba.new_balance,
    wba.change_amount,
    wba.change_source,
    wba.transaction_id,
    wba.transaction_status,
    wba.created_at,
    wba.stack_trace
FROM wallet_balance_audit wba
WHERE wba.created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY wba.created_at DESC;

-- 5. Check for any other triggers on users or wallet_transactions tables
SELECT 
    'EXISTING TRIGGERS' as report_type,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('users', 'wallet_transactions')
ORDER BY event_object_table, trigger_name;

-- 6. Check for any functions that might be updating wallet_balance
SELECT 
    'FUNCTIONS_UPDATING_WALLET' as report_type,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_balance%'
AND routine_type = 'FUNCTION';

-- Grant permissions
GRANT SELECT, INSERT ON wallet_balance_audit TO service_role;
GRANT SELECT, INSERT ON wallet_balance_audit TO authenticated;
