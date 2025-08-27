-- Test withdrawal functions to find the exact error
-- Run this in Supabase SQL Editor

-- 1. Test admin_get_withdrawal_requests_count with 'all' filter
SELECT 'Testing admin_get_withdrawal_requests_count with all filter' as test;

SELECT admin_get_withdrawal_requests_count('all') as count_result;

-- 2. Test admin_get_withdrawal_requests with 'all' filter and empty search
SELECT 'Testing admin_get_withdrawal_requests with all filter' as test;

SELECT * FROM admin_get_withdrawal_requests('all', '') LIMIT 5;

-- 3. Check if withdrawal_requests table has data
SELECT 'Checking withdrawal_requests table' as test;

SELECT 
  id,
  creator_id,
  amount,
  status,
  created_at
FROM withdrawal_requests 
LIMIT 3;

-- 4. Check if users table has creators linked to withdrawals
SELECT 'Checking users linked to withdrawals' as test;

SELECT DISTINCT
  u.id,
  u.name,
  u.email,
  u.role
FROM withdrawal_requests wr
JOIN users u ON u.id = wr.creator_id
LIMIT 3;
