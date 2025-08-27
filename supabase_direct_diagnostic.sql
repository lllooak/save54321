-- Run this directly in Supabase SQL Editor to diagnose doubling issue
-- Copy/paste this entire script and run it

-- 1. Check exactly what triggers exist on requests table
SELECT 
  '=== REQUESTS TABLE TRIGGERS ===' as section,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'requests'
ORDER BY trigger_name;

-- 2. Show the exact trigger function code
SELECT 
  '=== TRIGGER FUNCTION CODE ===' as section,
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_earnings_on_completion_trigger_func'
AND routine_type = 'FUNCTION';

-- 3. Check current complete_request_and_pay_creator RPC
SELECT 
  '=== RPC FUNCTION CODE ===' as section,
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator'
AND routine_type = 'FUNCTION';

-- 4. Find any other functions that update wallet_balance
SELECT 
  '=== ALL WALLET UPDATERS ===' as section,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_balance%'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 5. Check recent wallet transactions (last hour)
SELECT 
  '=== RECENT TRANSACTIONS ===' as section,
  created_at,
  user_id,
  type,
  amount,
  description,
  reference_id
FROM wallet_transactions 
WHERE type = 'earnings'
AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- 6. Show exactly how many earning transactions each user has
SELECT 
  '=== TRANSACTION COUNTS ===' as section,
  user_id,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  STRING_AGG(DISTINCT reference_id, ',') as request_ids
FROM wallet_transactions
WHERE type = 'earnings'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY transaction_count DESC;

-- 7. Test a specific user's wallet state (replace with actual user ID)
-- First, find a creator user_id:
SELECT 
  '=== SAMPLE CREATOR ===' as section,
  id as user_id,
  wallet_balance,
  email
FROM users 
WHERE role = 'creator' 
AND wallet_balance > 0
LIMIT 1;

-- INSTRUCTIONS:
-- 1. Run this script in Supabase SQL Editor
-- 2. Copy all results and paste them here
-- 3. I'll analyze the exact trigger/function setup
-- 4. Then we'll identify what's causing the doubling
