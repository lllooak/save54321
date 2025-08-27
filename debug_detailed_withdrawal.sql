-- Detailed debugging for withdrawal amount not updating
-- Let's check step by step what's happening

-- 1. Check the get_available_withdrawal_amount function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_available_withdrawal_amount';

-- 2. Test the function manually with a specific creator
WITH test_creator AS (
    SELECT id, name, wallet_balance 
    FROM users 
    WHERE role = 'creator' 
    AND wallet_balance > 0 
    LIMIT 1
)
SELECT 
    tc.name as creator_name,
    tc.wallet_balance,
    -- Manual calculation
    tc.wallet_balance - COALESCE((
        SELECT SUM(amount) 
        FROM withdrawal_requests 
        WHERE creator_id = tc.id AND status = 'pending'
    ), 0) as manual_calculation,
    -- Function result
    get_available_withdrawal_amount(tc.id) as function_result,
    -- Are they the same?
    CASE 
        WHEN (tc.wallet_balance - COALESCE((
            SELECT SUM(amount) 
            FROM withdrawal_requests 
            WHERE creator_id = tc.id AND status = 'pending'
        ), 0)) = get_available_withdrawal_amount(tc.id) THEN 'MATCH'
        ELSE 'MISMATCH'
    END as comparison
FROM test_creator tc;

-- 3. Check recent wallet transactions and earnings for the same creator
WITH test_creator AS (
    SELECT id, name 
    FROM users 
    WHERE role = 'creator' 
    AND wallet_balance > 0 
    LIMIT 1
),
recent_data AS (
    SELECT 
        tc.name,
        -- Recent earnings
        COALESCE(SUM(CASE WHEN e.status = 'completed' THEN e.amount ELSE 0 END), 0) as completed_earnings,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed_earnings_count,
        -- Recent wallet transactions
        COALESCE(SUM(CASE WHEN wt.type = 'earning' THEN wt.amount ELSE 0 END), 0) as earning_transactions_total,
        COUNT(CASE WHEN wt.type = 'earning' THEN 1 END) as earning_transactions_count,
        -- Timeframes
        MAX(e.created_at) as last_earning_update,
        MAX(wt.created_at) as last_wallet_transaction
    FROM test_creator tc
    LEFT JOIN earnings e ON e.creator_id = tc.id 
        AND e.created_at > CURRENT_DATE - INTERVAL '7 days'
    LEFT JOIN wallet_transactions wt ON wt.user_id = tc.id 
        AND wt.created_at > CURRENT_DATE - INTERVAL '7 days'
    GROUP BY tc.name
)
SELECT * FROM recent_data;

-- 4. Check if there are duplicate earning transactions (the original bug)
WITH test_creator AS (
    SELECT id, name 
    FROM users 
    WHERE role = 'creator' 
    AND wallet_balance > 0 
    LIMIT 1
)
SELECT 
    tc.name,
    wt.reference_id as request_reference,
    COUNT(*) as transaction_count,
    SUM(wt.amount) as total_amount,
    STRING_AGG(wt.id::text, ', ') as transaction_ids
FROM test_creator tc
JOIN wallet_transactions wt ON wt.user_id = tc.id
WHERE wt.type = 'earning'
AND wt.created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY tc.name, wt.reference_id
HAVING COUNT(*) > 1
ORDER BY transaction_count DESC;

-- 5. Check if the wallet balance and available withdrawal match expectations
WITH creator_summary AS (
    SELECT 
        u.id,
        u.name,
        u.wallet_balance as current_wallet_balance,
        get_available_withdrawal_amount(u.id) as available_withdrawal,
        -- Calculate expected wallet balance from transactions
        COALESCE((
            SELECT SUM(CASE 
                WHEN wt.type IN ('earning', 'top_up', 'refund') THEN wt.amount 
                WHEN wt.type IN ('purchase', 'fee', 'withdrawal') THEN -wt.amount 
                ELSE 0 
            END)
            FROM wallet_transactions wt 
            WHERE wt.user_id = u.id
        ), 0) as calculated_balance_from_transactions,
        -- Pending withdrawals
        COALESCE((
            SELECT SUM(amount) 
            FROM withdrawal_requests 
            WHERE creator_id = u.id AND status = 'pending'
        ), 0) as pending_withdrawals
    FROM users u
    WHERE u.role = 'creator'
    AND u.wallet_balance > 0
    ORDER BY u.wallet_balance DESC
    LIMIT 3
)
SELECT 
    name,
    current_wallet_balance,
    calculated_balance_from_transactions,
    current_wallet_balance - calculated_balance_from_transactions as balance_difference,
    available_withdrawal,
    current_wallet_balance - pending_withdrawals as expected_available,
    available_withdrawal - (current_wallet_balance - pending_withdrawals) as availability_difference
FROM creator_summary;
