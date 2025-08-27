-- Deep audit for Supabase-level doubling issues
-- Check for multiple triggers, race conditions, and other causes

-- Step 1: Check ALL triggers on requests table
SELECT 
  'TRIGGERS ON REQUESTS TABLE' as audit_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'requests'
ORDER BY trigger_name;

-- Step 2: Check ALL triggers on earnings table  
SELECT 
  'TRIGGERS ON EARNINGS TABLE' as audit_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'earnings'
ORDER BY trigger_name;

-- Step 3: Check ALL functions that might update wallet_balance
SELECT 
  'WALLET BALANCE UPDATERS' as audit_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_balance%'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Step 4: Check recent wallet transactions to see double entries in real-time
SELECT 
  'RECENT WALLET TRANSACTIONS' as audit_type,
  created_at,
  user_id,
  type,
  amount,
  description,
  reference_id,
  ROW_NUMBER() OVER (PARTITION BY user_id, amount, reference_id ORDER BY created_at) as sequence_num
FROM wallet_transactions 
WHERE type = 'earnings'
AND created_at >= NOW() - INTERVAL '1 hour'  -- Recent transactions
ORDER BY created_at DESC, user_id;

-- Step 5: Check if there are any other wallet balance update mechanisms
SELECT 
  'ALL WALLET REFERENCES' as audit_type,
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats 
WHERE attname ILIKE '%wallet%'
ORDER BY schemaname, tablename;

-- Step 6: Create a test scenario to trace exactly what happens
-- This will help us see the exact sequence of events
CREATE OR REPLACE FUNCTION trace_wallet_update(
  p_user_id uuid,
  p_action text DEFAULT 'trace'
)
RETURNS TABLE (
  step_num int,
  step_desc text,
  current_balance numeric,
  transactions_count bigint,
  latest_transaction_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
  v_count bigint;  
  v_latest_amount numeric;
BEGIN
  -- Get current state
  SELECT wallet_balance INTO v_balance FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_count FROM wallet_transactions WHERE user_id = p_user_id AND type = 'earnings';
  SELECT amount INTO v_latest_amount FROM wallet_transactions 
  WHERE user_id = p_user_id AND type = 'earnings' 
  ORDER BY created_at DESC LIMIT 1;
  
  RETURN QUERY SELECT 
    1::int,
    'Current wallet state for user: ' || p_user_id::text,
    COALESCE(v_balance, 0),
    COALESCE(v_count, 0),
    COALESCE(v_latest_amount, 0);
END;
$$;

-- Step 7: Check for any RLS policies that might cause issues
SELECT 
  'RLS POLICIES' as audit_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('users', 'wallet_transactions', 'earnings', 'requests')
ORDER BY tablename, policyname;

-- DIAGNOSTIC INSTRUCTIONS:
-- Run this script and then immediately test completing a request
-- Before test: note wallet balance
-- Complete request via app
-- After test: run the trace function to see what changed

SELECT 'NEXT STEPS' as instructions,
'1. Run this audit script' as step1,
'2. Note current wallet balance in app' as step2, 
'3. Complete one request via app' as step3,
'4. Run: SELECT * FROM trace_wallet_update(''YOUR_USER_ID'');' as step4,
'5. Compare before/after to see double updates' as step5;
