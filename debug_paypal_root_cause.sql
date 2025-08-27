-- COMPREHENSIVE PAYPAL DEBUGGING SCRIPT
-- Run this immediately after a PayPal transaction to identify the root cause

-- 1. Check if our trigger exists and is active
SELECT 
    'TRIGGER STATUS' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_body
FROM information_schema.triggers 
WHERE trigger_name LIKE '%wallet%' 
   OR event_object_table = 'wallet_transactions';

-- 2. Check for duplicate transactions with same PayPal order ID
SELECT 
    'DUPLICATE PAYPAL ORDERS' as check_type,
    reference_id as paypal_order_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    ARRAY_AGG(id ORDER BY created_at) as transaction_ids,
    ARRAY_AGG(payment_status ORDER BY created_at) as statuses,
    ARRAY_AGG(created_at ORDER BY created_at) as created_times,
    ARRAY_AGG(updated_at ORDER BY created_at) as updated_times
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND reference_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '2 hours'
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- 3. Check all recent PayPal transactions with detailed info
SELECT 
    'ALL RECENT PAYPAL TRANSACTIONS' as check_type,
    id,
    user_id,
    amount,
    payment_status,
    reference_id,
    description,
    created_at,
    updated_at,
    (updated_at - created_at) as processing_time
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND created_at >= NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;

-- 4. Check wallet balance progression for affected users
WITH recent_transactions AS (
    SELECT DISTINCT user_id 
    FROM wallet_transactions 
    WHERE payment_method = 'paypal' 
    AND created_at >= NOW() - INTERVAL '2 hours'
)
SELECT 
    'WALLET BALANCE PROGRESSION' as check_type,
    u.id as user_id,
    u.wallet_balance as current_balance,
    u.updated_at as balance_updated_at,
    wt.id as transaction_id,
    wt.amount as transaction_amount,
    wt.payment_status,
    wt.created_at as transaction_created,
    wt.updated_at as transaction_updated,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY wt.created_at) as transaction_sequence
FROM users u
JOIN recent_transactions rt ON u.id = rt.user_id
LEFT JOIN wallet_transactions wt ON u.id = wt.user_id 
    AND wt.payment_method = 'paypal' 
    AND wt.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY u.id, wt.created_at;

-- 5. Check for transactions with same reference_id but different amounts
SELECT 
    'AMOUNT DISCREPANCIES' as check_type,
    reference_id,
    COUNT(DISTINCT amount) as different_amounts,
    ARRAY_AGG(DISTINCT amount) as amounts,
    ARRAY_AGG(id) as transaction_ids
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND reference_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '2 hours'
GROUP BY reference_id
HAVING COUNT(DISTINCT amount) > 1;

-- 6. Check for logs if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logs') THEN
        EXECUTE 'SELECT ''TRANSACTION LOGS'' as check_type, level, message, created_at FROM logs WHERE message LIKE ''%wallet%'' OR message LIKE ''%transaction%'' ORDER BY created_at DESC LIMIT 50';
    ELSE
        RAISE NOTICE 'Logs table does not exist';
    END IF;
END $$;

-- 7. Check for any pending or failed transactions
SELECT 
    'FAILED_OR_PENDING' as check_type,
    id,
    user_id,
    amount,
    payment_status,
    reference_id,
    created_at,
    updated_at,
    (NOW() - created_at) as age
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND payment_status IN ('pending', 'failed')
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 8. Show current database trigger function definition
SELECT 
    'CURRENT TRIGGER FUNCTION' as check_type,
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_wallet_balance_safe';
