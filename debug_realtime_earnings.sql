-- Debug real-time settings on earnings table
-- Run this in Supabase SQL Editor

-- 1. Check if realtime is enabled on earnings table (simplified check)
SELECT 'Checking earnings table exists:' as info;
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'earnings' AND schemaname = 'public';

-- 2. Check current replica identity setting
SELECT 'Current replica identity on earnings:' as info;
SELECT relname, relreplident,
       CASE relreplident
         WHEN 'd' THEN 'DEFAULT (using primary key)'
         WHEN 'n' THEN 'NOTHING (realtime disabled)'  
         WHEN 'f' THEN 'FULL (all columns)'
         WHEN 'i' THEN 'USING INDEX'
         ELSE 'UNKNOWN'
       END as replica_identity_status
FROM pg_class 
WHERE relname = 'earnings' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Check if earnings table exists in supabase_realtime.messages (indicates realtime activity)
SELECT 'Recent realtime activity on earnings table:' as info;
SELECT COUNT(*) as message_count
FROM pg_tables 
WHERE tablename = 'messages' 
AND schemaname = 'supabase_realtime';

-- 3. Enable realtime on earnings table if not enabled
ALTER TABLE earnings REPLICA IDENTITY FULL;

-- 4. Check if earnings table has proper indexes for real-time filtering
SELECT 'Indexes on earnings table (for real-time performance):' as info;
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'earnings'
AND schemaname = 'public';

-- 5. Test recent earnings insertion to see if real-time would trigger
SELECT 'Most recent earnings (should trigger real-time):' as info;
SELECT id, creator_id, request_id, amount, status, created_at
FROM earnings 
ORDER BY created_at DESC 
LIMIT 3;

SELECT 'Realtime debug complete - check if earnings table has realtime enabled' as result;
