-- Diagnose why we got no results

-- Check if there are ANY pending requests
SELECT 'ALL PENDING REQUESTS' as info,
       COUNT(*) as pending_count
FROM requests 
WHERE status = 'pending';

-- Show all pending requests (if any)
SELECT 'PENDING REQUEST DETAILS' as info,
       id::text as request_id,
       creator_id::text as creator_id,
       price,
       status,
       created_at
FROM requests 
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- Check if the specific prefix request still exists
SELECT 'PREFIX MATCH CHECK' as info,
       COUNT(*) as prefix_matches
FROM requests 
WHERE status = 'pending' 
AND id::text LIKE '2b6dbea5-%';

-- Check if the request was already completed
SELECT 'REQUEST STATUS CHECK' as info,
       id::text as request_id,
       status,
       updated_at
FROM requests 
WHERE id::text LIKE '2b6dbea5-%'
LIMIT 1;

-- If no pending requests, let's use ANY pending request
SELECT 'FIRST AVAILABLE PENDING' as info,
       id::text as request_id,
       creator_id::text as creator_id,
       price
FROM requests 
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 1;
