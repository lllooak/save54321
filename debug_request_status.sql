-- Debug request status issue

-- Check recent requests and their statuses
-- Replace 'YOUR_REQUEST_ID_HERE' with the actual request ID you're trying to complete
SELECT 
  'RECENT REQUESTS' as info,
  id,
  creator_id,
  fan_id,
  status,
  price,
  created_at,
  updated_at
FROM requests 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if there are any pending requests
SELECT 
  'PENDING REQUESTS COUNT' as info,
  COUNT(*) as pending_count
FROM requests 
WHERE status = 'pending';

-- Check if there are already earnings for recent requests
SELECT 
  'RECENT EARNINGS' as info,
  e.request_id,
  e.amount,
  e.status,
  r.status as request_status
FROM earnings e
JOIN requests r ON e.request_id = r.id
ORDER BY e.created_at DESC
LIMIT 5;

SELECT 'REQUEST STATUS DEBUG COMPLETE' as status;
