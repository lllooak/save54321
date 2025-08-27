-- Complete PayPal debugging script - run this after a test PayPal transaction
-- This will show us exactly what's happening with your PayPal transactions

-- 1. Check for duplicate transactions with same PayPal order ID
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
    AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- 2. Check all recent PayPal transactions
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
    AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 3. Check wallet balance changes for the specific user
-- Replace 'YOUR_USER_ID' with your actual user ID
SELECT 
    'WALLET BALANCE CHANGES' as check_type,
    wt.id as transaction_id,
    wt.amount as transaction_amount,
    wt.payment_status,
    wt.created_at,
    wt.updated_at,
    u.wallet_balance as current_wallet_balance,
    LAG(u.wallet_balance) OVER (ORDER BY wt.created_at) as previous_balance,
    u.wallet_balance - LAG(u.wallet_balance) OVER (ORDER BY wt.created_at) as balance_change
FROM wallet_transactions wt
JOIN users u ON wt.user_id = u.id
WHERE 
    wt.payment_method = 'paypal' 
    AND wt.type = 'top_up'
    AND wt.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY wt.created_at DESC;

-- 4. Skip logs check since logs table doesn't exist
-- This section is commented out because the logs table hasn't been created yet
-- SELECT 'TRANSACTION LOGS' as check_type, 'No logs table' as message;

-- 5. Check for any users with recent wallet balance changes
SELECT 
    'RECENT WALLET CHANGES' as check_type,
    u.id as user_id,
    u.wallet_balance,
    u.updated_at as wallet_updated_at,
    COUNT(wt.id) as transaction_count,
    SUM(wt.amount) as total_transaction_amount
FROM users u
LEFT JOIN wallet_transactions wt ON u.id = wt.user_id 
WHERE 
    u.updated_at >= NOW() - INTERVAL '1 hour'
    OR wt.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY u.id, u.wallet_balance, u.updated_at
ORDER BY u.updated_at DESC;

-- 6. Check for any pending transactions that might be stuck
SELECT 
    'PENDING TRANSACTIONS' as check_type,
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
    AND payment_status = 'pending'
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
