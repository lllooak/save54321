-- Test with the available pending request

-- Find and test with the available pending request
WITH target_request AS (
  SELECT id, creator_id, price
  FROM requests 
  WHERE status = 'pending' 
  AND id::text LIKE '0438323f-%'
  LIMIT 1
)
SELECT 'TESTING WITH AVAILABLE REQUEST' as info,
       id::text as full_uuid,
       creator_id::text as creator_uuid,
       price
FROM target_request;

-- Test the function with this UUID
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE status = 'pending' 
  AND id::text LIKE '0438323f-%'
  LIMIT 1
)
SELECT 'FUNCTION RESULT' as info,
       complete_request_and_pay_creator(tr.id) as result
FROM target_request tr;

-- Check request status after
WITH target_request AS (
  SELECT id
  FROM requests 
  WHERE id::text LIKE '0438323f-%'
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
  WHERE id::text LIKE '0438323f-%'
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
  WHERE id::text LIKE '0438323f-%'
  LIMIT 1
)
SELECT 'WALLET TRANSACTIONS CHECK' as info,
       wt.type,
       wt.amount,
       wt.reference_id
FROM target_request tr
LEFT JOIN wallet_transactions wt ON wt.reference_id = tr.id::text
ORDER BY wt.created_at DESC;

SELECT 'TEST WITH AVAILABLE REQUEST COMPLETE' as status;
