-- Debug earnings table and real-time updates after video upload
-- Run this in Supabase SQL Editor

-- 1. Check recent earnings records (should show video upload earnings)
SELECT 'Recent earnings records (last 10):' as info;
SELECT id, creator_id, request_id, amount, status, created_at
FROM earnings 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check if there's any earnings data at all
SELECT 'Total earnings records count:' as info;
SELECT COUNT(*) as total_count
FROM earnings;

-- 3. Check if earnings table structure matches what frontend expects
SELECT 'Earnings table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'earnings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check recent wallet_transactions to compare
SELECT 'Recent wallet_transactions with earnings type:' as info;
SELECT id, user_id, type, amount, description, created_at
FROM wallet_transactions 
WHERE type IN ('earning', 'earnings')
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Test if there's an earnings record for a specific recent request
-- (Replace with actual recent request ID if you know one)
SELECT 'Sample earnings-to-request mapping:' as info;
SELECT e.id as earning_id, e.request_id, r.status as request_status, e.amount, e.status as earning_status
FROM earnings e
LEFT JOIN requests r ON e.request_id = r.id
ORDER BY e.created_at DESC
LIMIT 5;

SELECT 'Debug complete - check if earnings are being created' as result;
