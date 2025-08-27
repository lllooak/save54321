-- Debug wallet transactions to identify double-counting issue
-- Check what wallet transactions are being created for creators

-- Recent wallet transactions for creators (last 10)
SELECT 
    wt.id,
    u.name,
    u.role,
    wt.type,
    wt.amount,
    wt.payment_status,
    wt.description,
    wt.reference_id,
    wt.created_at,
    -- Show current wallet balance
    u.wallet_balance as current_wallet_balance
FROM wallet_transactions wt
JOIN users u ON wt.user_id = u.id
WHERE u.role = 'creator'
ORDER BY wt.created_at DESC
LIMIT 20;

-- Check if there are duplicate transactions for the same request
SELECT 
    wt.reference_id as request_id,
    u.name as creator_name,
    COUNT(*) as transaction_count,
    SUM(wt.amount) as total_amount,
    array_agg(wt.type) as transaction_types,
    array_agg(wt.description) as descriptions
FROM wallet_transactions wt
JOIN users u ON wt.user_id = u.id
WHERE u.role = 'creator' 
AND wt.reference_id IS NOT NULL
GROUP BY wt.reference_id, u.name
HAVING COUNT(*) > 1  -- Only show requests with multiple transactions
ORDER BY wt.reference_id;

-- Check earnings vs wallet transactions correlation
SELECT 
    e.request_id,
    e.amount as earnings_amount,
    e.status as earnings_status,
    r.price as request_price,
    COUNT(wt.id) as wallet_transaction_count,
    SUM(CASE WHEN wt.type = 'earning' THEN wt.amount ELSE 0 END) as total_earning_transactions,
    array_agg(wt.amount) as transaction_amounts,
    array_agg(wt.type) as transaction_types
FROM earnings e
JOIN requests r ON e.request_id = r.id
LEFT JOIN wallet_transactions wt ON wt.reference_id = e.request_id::text
WHERE e.creator_id = (
    -- Get a creator who has recent activity
    SELECT creator_id FROM earnings ORDER BY created_at DESC LIMIT 1
)
GROUP BY e.request_id, e.amount, e.status, r.price
ORDER BY e.request_id DESC;
