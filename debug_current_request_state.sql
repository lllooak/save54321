-- Debug the current state of the request that's failing to upload
-- Check what records exist and why duplicate prevention is triggering

-- Replace with your actual failing request ID
\set request_id 'd10fdb51-eb0e-4fc3-83c4-d2430cbafc49'

-- Check request details
SELECT 
  'REQUEST DETAILS' as table_name,
  id,
  creator_id,
  fan_id,
  price,
  status,
  video_url,
  created_at,
  updated_at
FROM requests 
WHERE id = :'request_id'::uuid;

-- Check if earnings exist for this request
SELECT 
  'EARNINGS RECORDS' as table_name,
  id,
  creator_id,
  request_id,
  amount,
  status,
  created_at
FROM earnings 
WHERE request_id = :'request_id'::uuid;

-- Check wallet transactions for this request
SELECT 
  'WALLET TRANSACTIONS' as table_name,
  id,
  user_id,
  type,
  amount,
  description,
  reference_id,
  created_at
FROM wallet_transactions 
WHERE reference_id = :'request_id'::text;

-- Check what the function would return
SELECT 
  'FUNCTION TEST' as test_name,
  complete_request_and_pay_creator(:'request_id'::uuid) as result;
