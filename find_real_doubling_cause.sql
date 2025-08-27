-- Alternative diagnostic: If triggers don't update wallet_balance, 
-- then doubling must be happening elsewhere

-- Test 1: Check if RPC function is being called multiple times
-- Look for recent RPC calls in logs (if available)
SELECT 
  'RPC FUNCTION CHECK' as test_type,
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator'
AND routine_definition ILIKE '%wallet_balance%';

-- Test 2: Check all functions that update wallet_balance
SELECT 
  'ALL WALLET UPDATERS' as test_type,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_definition ILIKE '%wallet_balance%' THEN 'UPDATES_WALLET'
    ELSE 'NO_WALLET_UPDATE'
  END as wallet_update_status
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_balance%'
ORDER BY routine_name;

-- Test 3: Check if triggers call functions that update wallet_balance
SELECT 
  'TRIGGER FUNCTION CHAIN' as test_type,
  t.trigger_name,
  REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '') as function_name
FROM information_schema.triggers t
WHERE t.event_object_table = 'requests'
AND t.event_manipulation = 'UPDATE';

-- Test 4: Now check if any of those trigger functions update wallet_balance
SELECT 
  'TRIGGER FUNCTIONS THAT UPDATE WALLET' as test_type,
  r.routine_name,
  'YES - UPDATES WALLET_BALANCE' as status
FROM information_schema.routines r
WHERE r.routine_name IN (
  SELECT REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
  FROM information_schema.triggers t
  WHERE t.event_object_table = 'requests'
  AND t.event_manipulation = 'UPDATE'
)
AND r.routine_definition ILIKE '%wallet_balance%';

-- Test 5: Create a real-time wallet tracking test
-- This will help us see exactly when wallet balance changes
CREATE OR REPLACE FUNCTION track_wallet_changes(p_user_id uuid)
RETURNS TABLE (
  timestamp_check timestamptz,
  current_balance numeric,
  recent_transactions text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    NOW() as timestamp_check,
    u.wallet_balance as current_balance,
    STRING_AGG(
      wt.created_at::text || ': ' || wt.type || ' ' || wt.amount::text,
      ' | '
      ORDER BY wt.created_at DESC
    ) as recent_transactions
  FROM users u
  LEFT JOIN wallet_transactions wt ON wt.user_id = u.id 
    AND wt.created_at >= NOW() - INTERVAL '10 minutes'
  WHERE u.id = p_user_id
  GROUP BY u.wallet_balance;
END;
$$;

-- INSTRUCTIONS FOR TESTING:
-- 1. Run all the queries above first
-- 2. Note current wallet balance: SELECT * FROM track_wallet_changes('01d9223d-1e25-4bbe-8c7a-8e6b8c7a8e6b');
-- 3. Complete ONE request in the app
-- 4. Immediately run: SELECT * FROM track_wallet_changes('01d9223d-1e25-4bbe-8c7a-8e6b8c7a8e6b');
-- 5. Compare the before/after to see exactly what happened

SELECT 'READY FOR REAL-TIME TEST' as next_step;
