-- Debug why "Available for withdrawal" is not updating properly
-- Check the calculation logic and current state

-- 1. Check current state for a specific creator
SELECT 
    u.id as creator_id,
    u.name,
    u.wallet_balance,
    -- Manual calculation of available withdrawal
    (
        u.wallet_balance - COALESCE((
            SELECT SUM(amount) 
            FROM withdrawal_requests 
            WHERE creator_id = u.id AND status = 'pending'
        ), 0)
    ) as manual_available_withdrawal,
    -- Using the function
    get_available_withdrawal_amount(u.id) as function_available_withdrawal,
    -- Check for pending withdrawals
    (
        SELECT COALESCE(SUM(amount), 0) 
        FROM withdrawal_requests 
        WHERE creator_id = u.id AND status = 'pending'
    ) as pending_withdrawals_total
FROM users u
WHERE u.role = 'creator'
AND u.wallet_balance > 0
ORDER BY u.wallet_balance DESC
LIMIT 5;

-- 2. Check recent wallet transactions vs withdrawal calculation
SELECT 
    u.name as creator_name,
    u.wallet_balance as current_wallet_balance,
    get_available_withdrawal_amount(u.id) as available_withdrawal,
    -- Recent wallet transaction totals
    (
        SELECT COALESCE(SUM(CASE 
            WHEN wt.type IN ('earning', 'top_up', 'refund') THEN wt.amount 
            WHEN wt.type IN ('purchase', 'fee') THEN -wt.amount 
            ELSE 0 
        END), 0)
        FROM wallet_transactions wt 
        WHERE wt.user_id = u.id
        AND wt.created_at > CURRENT_DATE - INTERVAL '7 days'
    ) as recent_transaction_net,
    -- Count recent earning transactions
    (
        SELECT COUNT(*) 
        FROM wallet_transactions wt 
        WHERE wt.user_id = u.id 
        AND wt.type = 'earning'
        AND wt.created_at > CURRENT_DATE - INTERVAL '7 days'
    ) as recent_earning_transactions
FROM users u
WHERE u.role = 'creator'
AND EXISTS (
    SELECT 1 FROM wallet_transactions wt 
    WHERE wt.user_id = u.id 
    AND wt.created_at > CURRENT_DATE - INTERVAL '7 days'
)
ORDER BY u.wallet_balance DESC
LIMIT 5;

-- 3. Check if get_available_withdrawal_amount function is working correctly
SELECT 
    'Function Test' as test_type,
    get_available_withdrawal_amount((
        SELECT id FROM users WHERE role = 'creator' ORDER BY wallet_balance DESC LIMIT 1
    )) as withdrawal_amount_result;

-- 4. Check for any withdrawal requests that might be affecting the calculation
SELECT 
    wr.creator_id,
    u.name,
    wr.amount as withdrawal_amount,
    wr.status,
    wr.created_at,
    u.wallet_balance as current_balance,
    get_available_withdrawal_amount(wr.creator_id) as available_after_pending
FROM withdrawal_requests wr
JOIN users u ON wr.creator_id = u.id
WHERE wr.status = 'pending'
ORDER BY wr.created_at DESC;
