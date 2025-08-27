-- Get complete UUID without truncation

SELECT 
  'COMPLETE UUID' as info,
  id::text as full_uuid,
  length(id::text) as uuid_length,
  creator_id::text as creator_uuid,
  price
FROM requests 
WHERE status = 'pending'
ORDER BY created_at DESC 
LIMIT 3;
