-- Simple step-by-step diagnostic
-- Run each query ONE AT A TIME in Supabase SQL Editor

-- Query 1: Check if any triggers exist on requests table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'requests';

-- STOP HERE - Run this first and tell me the result
-- If you get results, continue to Query 2
-- If you get no results, that means NO TRIGGERS EXIST (this could be the problem!)

-- Query 2: Check if the trigger function exists
SELECT 
  routine_name
FROM information_schema.routines 
WHERE routine_name = 'update_earnings_on_completion_trigger_func';

-- Query 3: Check if the RPC function exists
SELECT 
  routine_name
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator';

-- Query 4: Check recent wallet transactions for this specific user
SELECT 
  created_at,
  type,
  amount,
  description,
  reference_id
FROM wallet_transactions 
WHERE user_id = '01d9223d-1e25-4bbe-8c7a-8e6b8c7a8e6b'  -- Replace with actual user ID
AND type = 'earnings'
ORDER BY created_at DESC
LIMIT 10;
