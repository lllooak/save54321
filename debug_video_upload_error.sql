-- Debug query to investigate "Request not found or already completed" error
-- Run this query when a creator gets the upload error to see what's happening

-- Replace 'REQUEST_ID_HERE' with the actual request ID that's failing
-- You can get the request ID from the browser console or RequestDetails component

-- 1. Check if request exists and its current status
SELECT 
    id,
    creator_id,
    fan_id,
    title,
    price,
    status,
    created_at,
    updated_at,
    video_url
FROM requests 
WHERE id = 'REQUEST_ID_HERE';

-- 2. Check if there are already earnings/transactions for this request
SELECT 
    wt.id,
    wt.user_id,
    wt.type,
    wt.amount,
    wt.description,
    wt.reference_id,
    wt.created_at
FROM wallet_transactions wt
WHERE wt.reference_id = 'REQUEST_ID_HERE'
ORDER BY wt.created_at DESC;

-- 3. Check earnings table for this request
SELECT 
    e.id,
    e.creator_id,
    e.fan_id,
    e.request_id,
    e.amount,
    e.platform_fee,
    e.status,
    e.created_at
FROM earnings e
WHERE e.request_id = 'REQUEST_ID_HERE';

-- 4. Check all possible request statuses in the system
SELECT DISTINCT status, COUNT(*) as count
FROM requests 
GROUP BY status
ORDER BY count DESC;

-- 5. Alternative: Check requests for the specific creator
-- Replace 'CREATOR_ID_HERE' with the creator's ID
/*
SELECT 
    id,
    title,
    status,
    price,
    created_at,
    updated_at
FROM requests 
WHERE creator_id = 'CREATOR_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;
*/
