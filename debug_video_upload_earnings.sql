-- Debug why הכנסות ותשלומים (Earnings and Payments) not updating after video upload
-- Run this in Supabase SQL Editor

-- 1. Check recent wallet transactions (what was inserted during video upload)
SELECT 'Recent wallet transactions (last 20):' as info;
SELECT id, user_id, type, amount, description, created_at
FROM wallet_transactions 
ORDER BY created_at DESC 
LIMIT 20;

-- 2. Check what transaction types exist now
SELECT 'All transaction types in wallet_transactions:' as info;
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- 3. Check if earnings function exists and what it returns
SELECT 'Checking earnings calculation function:' as info;
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name ILIKE '%earning%' 
AND routine_schema = 'public'
ORDER BY routine_name;

-- 4. Test basic earnings calculation for current user (if we know the user ID)
-- Replace 'YOUR_USER_ID' with actual UUID from the frontend
-- SELECT 'Total earnings for user:' as info;
-- SELECT user_id, SUM(amount) as total_earnings
-- FROM wallet_transactions 
-- WHERE user_id = 'YOUR_USER_ID' AND type IN ('earning', 'earnings', 'video_earning', 'request_earning')
-- GROUP BY user_id;

-- 5. Check if there are any functions that calculate balance or earnings
SELECT 'Functions that might calculate earnings/balance:' as info;
SELECT routine_name, routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_transactions%'
AND routine_schema = 'public'
ORDER BY routine_name;

SELECT 'Debug complete - check results above' as result;
