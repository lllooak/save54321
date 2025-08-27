-- Check specific pending requests to see their IDs

-- Show recent pending requests with full details
SELECT 
  'PENDING REQUESTS' as info,
  id,
  creator_id,
  fan_id,
  status,
  price,
  created_at
FROM requests 
WHERE status = 'pending'
ORDER BY created_at DESC 
LIMIT 10;

-- Show recent completed requests to see if some were just processed
SELECT 
  'RECENT COMPLETED' as info,
  id,
  creator_id,
  fan_id,
  status,
  price,
  updated_at
FROM requests 
WHERE status = 'completed'
ORDER BY updated_at DESC 
LIMIT 5;
