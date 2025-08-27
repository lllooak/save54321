-- Show only pending requests

SELECT 
  id,
  creator_id,
  fan_id,
  price,
  created_at
FROM requests 
WHERE status = 'pending'
ORDER BY created_at DESC 
LIMIT 10;
