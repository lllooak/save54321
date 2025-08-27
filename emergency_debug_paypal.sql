-- EMERGENCY DEBUGGING - DISABLE ALL TRIGGERS AND TRACE UPDATES
-- This will help us identify if the issue is from triggers or something else

-- 1. DISABLE ALL WALLET-RELATED TRIGGERS TEMPORARILY
DROP TRIGGER IF EXISTS update_wallet_balance_trigger ON wallet_transactions;
DROP TRIGGER IF EXISTS update_wallet_balance_trigger_safe ON wallet_transactions;
DROP TRIGGER IF EXISTS update_wallet_balance_trigger_with_audit ON wallet_transactions;
DROP TRIGGER IF EXISTS audit_wallet_balance_trigger ON users;

-- 2. CREATE A SIMPLE AUDIT TABLE TO TRACK DIRECT UPDATES
CREATE TABLE IF NOT EXISTS emergency_wallet_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    old_balance NUMERIC,
    new_balance NUMERIC,
    change_amount NUMERIC,
    function_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. CREATE A TRIGGER TO LOG DIRECT UPDATES TO USERS TABLE
CREATE OR REPLACE FUNCTION emergency_audit_wallet_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO emergency_wallet_audit (
        user_id, 
        old_balance, 
        new_balance, 
        change_amount,
        function_name
    ) VALUES (
        NEW.id,
        OLD.wallet_balance,
        NEW.wallet_balance,
        NEW.wallet_balance - COALESCE(OLD.wallet_balance, 0),
        'DIRECT_USERS_UPDATE'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emergency_wallet_audit_trigger
    AFTER UPDATE OF wallet_balance ON users
    FOR EACH ROW
    EXECUTE FUNCTION emergency_audit_wallet_changes();

-- 4. MODIFY THE EDGE FUNCTION TO HANDLE WALLET UPDATE MANUALLY
-- Since we disabled triggers, we need to update the balance manually
-- Add this to your capture-paypal-payment edge function after updating transaction status:

/*
// Add this to your edge function after updating transaction status to 'completed'
const { error: balanceError } = await supabase
  .from('users')
  .update({
    wallet_balance: supabase.raw('COALESCE(wallet_balance, 0) + ?', [paymentAmount])
  })
  .eq('id', user.id);

if (balanceError) {
  console.error('Failed to update wallet balance:', balanceError);
  throw new Error('Failed to update wallet balance');
}
*/

-- 5. CHECK FOR DUPLICATE REQUESTS
-- Run this query after a PayPal transaction to see if there are duplicate updates
SELECT 
    'EMERGENCY AUDIT' as type,
    id,
    user_id,
    old_balance,
    new_balance,
    change_amount,
    function_name,
    created_at
FROM emergency_wallet_audit
WHERE created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 6. CHECK FOR DUPLICATE TRANSACTIONS
SELECT 
    'DUPLICATE CHECK' as type,
    reference_id,
    COUNT(*) as count,
    ARRAY_AGG(id) as transaction_ids,
    ARRAY_AGG(amount) as amounts
FROM wallet_transactions
WHERE payment_method = 'paypal'
AND created_at >= NOW() - INTERVAL '10 minutes'
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- 7. SHOW ALL ACTIVE TRIGGERS
SELECT 
    'ACTIVE TRIGGERS' as type,
    trigger_name,
    event_object_table,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table IN ('users', 'wallet_transactions')
ORDER BY event_object_table, trigger_name;
