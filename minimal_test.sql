-- Minimal test script with only guaranteed existing columns

-- Create minimal test function to isolate the 400 error
-- Run this in Supabase SQL Editor

-- Test 1: Create minimal function that just returns empty result
CREATE OR REPLACE FUNCTION admin_get_withdrawal_requests(
  p_status_filter text DEFAULT 'all',
  p_search_query text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  amount numeric,
  method text,
  paypal_email text,
  bank_details text,
  status text,
  created_at timestamp with time zone,
  processed_at timestamp with time zone,
  creator_name text,
  creator_email text,
  creator_avatar_url text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Test: Just return empty result to see if function works at all
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_get_withdrawal_requests TO authenticated;

-- Test 2: Also create the missing admin_get_recent_signups function
CREATE OR REPLACE FUNCTION admin_get_recent_signups()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN jsonb_build_array();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_recent_signups TO authenticated;

SELECT 'Minimal functions created - test on frontend now' as result;

-- Find and test with the most recent pending request using LIKE
WITH target_request AS (
  SELECT id, creator_id, price
  FROM requests 
  WHERE status = 'pending' 
  AND id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'TESTING WITH PREFIX-MATCHED REQUEST' as info,
       id::text as full_uuid,
       creator_id::text as creator_uuid,
       price
FROM target_request;

-- Now test the function with this UUID
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE status = 'pending' 
  AND id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'FUNCTION RESULT' as info,
       complete_request_and_pay_creator(tr.id) as result
FROM target_request tr;

-- Check request status after
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'REQUEST STATUS AFTER' as info,
       tr.id::text as request_id,
       r.status
FROM target_request tr
JOIN requests r ON r.id = tr.id;

-- Check earnings created
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'EARNINGS CHECK' as info,
       e.amount,
       e.status
FROM target_request tr
LEFT JOIN earnings e ON e.request_id = tr.id;

-- Check wallet transactions
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'WALLET TRANSACTIONS CHECK' as info,
       wt.type,
       wt.amount,
       wt.reference_id
FROM target_request tr
LEFT JOIN wallet_transactions wt ON wt.reference_id = tr.id::text
ORDER BY wt.created_at DESC;

-- Check creator wallet balance - NO USERNAME
WITH target_request AS (
  SELECT r.creator_id
  FROM requests r
  WHERE r.id::text LIKE '2b6dbea5-%'
  LIMIT 1
)
SELECT 'CREATOR WALLET BALANCE' as info,
       u.wallet_balance
FROM target_request tr
JOIN users u ON u.id = tr.creator_id;

SELECT 'MINIMAL TEST COMPLETE' as status;
