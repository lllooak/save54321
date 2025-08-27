-- Test the function with a real pending request ID

-- Use the most recent pending request: 2b6dbea5-1bfef39c8-246d0e55f-9
SELECT 'TESTING WITH REAL PENDING REQUEST' as info;

-- Test the function
SELECT complete_request_and_pay_creator('2b6dbea5-1bfef39c8-246d0e55f-9'::uuid) as result;

-- Check if the request was updated
SELECT 
  'REQUEST AFTER FUNCTION' as info,
  id,
  status,
  updated_at
FROM requests 
WHERE id = '2b6dbea5-1bfef39c8-246d0e55f-9'::uuid;

-- Check if earnings were created
SELECT 
  'EARNINGS CREATED' as info,
  request_id,
  amount,
  platform_fee,
  status
FROM earnings 
WHERE request_id = '2b6dbea5-1bfef39c8-246d0e55f-9'::uuid;

-- Check wallet transactions
SELECT 
  'WALLET TRANSACTIONS' as info,
  user_id,
  type,
  amount,
  reference_id
FROM wallet_transactions 
WHERE reference_id = '2b6dbea5-1bfef39c8-246d0e55f-9';

SELECT 'FUNCTION TEST COMPLETE' as status;
