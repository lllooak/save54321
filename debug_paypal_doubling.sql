-- Debug script to check for PayPal transaction duplicates
-- Run this in your Supabase SQL editor to identify the root cause

-- Check for duplicate transactions with same reference_id (PayPal order ID)
SELECT 
    reference_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    ARRAY_AGG(id) as transaction_ids,
    ARRAY_AGG(payment_status) as statuses,
    ARRAY_AGG(created_at) as created_times
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- Check for recent PayPal transactions to see the pattern
SELECT 
    id,
    user_id,
    amount,
    payment_status,
    reference_id,
    description,
    created_at,
    updated_at
FROM wallet_transactions 
WHERE 
    payment_method = 'paypal' 
    AND type = 'top_up'
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check wallet balance changes for a specific user (replace with your user ID)
SELECT 
    wt.id,
    wt.amount,
    wt.payment_status,
    wt.reference_id,
    wt.created_at,
    wt.updated_at,
    u.wallet_balance
FROM wallet_transactions wt
JOIN users u ON wt.user_id = u.id
WHERE 
    wt.payment_method = 'paypal' 
    AND wt.type = 'top_up'
    AND wt.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY wt.created_at DESC;
