-- Debug query to check earnings calculations
-- This will help identify earnings records with incorrect amounts

-- Check earnings vs request prices to see if 30% fee was applied
SELECT 
    e.id as earnings_id,
    r.id as request_id,
    r.price as full_request_price,
    e.amount as earnings_amount,
    ROUND((r.price * 0.70)::numeric, 2) as expected_net_amount,
    CASE 
        WHEN e.amount = r.price THEN 'INCORRECT - Full Amount'
        WHEN e.amount = ROUND((r.price * 0.70)::numeric, 2) THEN 'CORRECT - Net Amount (70%)'
        ELSE 'OTHER - Check Manually'
    END as calculation_status,
    e.status as earnings_status,
    r.status as request_status,
    r.created_at
FROM earnings e
JOIN requests r ON e.request_id = r.id
ORDER BY r.created_at DESC
LIMIT 20;

-- Summary of potential issues
SELECT 
    COUNT(*) as total_earnings,
    SUM(CASE WHEN e.amount = r.price THEN 1 ELSE 0 END) as full_amount_records,
    SUM(CASE WHEN e.amount = ROUND((r.price * 0.70)::numeric, 2) THEN 1 ELSE 0 END) as net_amount_records,
    SUM(CASE WHEN e.amount != r.price AND e.amount != ROUND((r.price * 0.70)::numeric, 2) THEN 1 ELSE 0 END) as other_records
FROM earnings e
JOIN requests r ON e.request_id = r.id;

-- Check total creator wallet balances vs expected net earnings
SELECT 
    u.id as creator_id,
    u.name,
    u.wallet_balance as current_wallet,
    SUM(CASE WHEN e.status = 'completed' THEN e.amount ELSE 0 END) as total_completed_earnings,
    SUM(CASE WHEN e.status = 'completed' THEN ROUND((r.price * 0.70)::numeric, 2) ELSE 0 END) as expected_net_earnings
FROM users u
LEFT JOIN earnings e ON u.id = e.creator_id
LEFT JOIN requests r ON e.request_id = r.id
WHERE u.role = 'creator'
GROUP BY u.id, u.name, u.wallet_balance
HAVING COUNT(e.id) > 0
ORDER BY u.name;
