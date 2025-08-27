-- Check withdrawal_requests table data for orphaned or problematic records
-- Run this in Supabase SQL Editor

-- 1. Check if withdrawal_requests table exists and has data
SELECT 'withdrawal_requests table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'withdrawal_requests' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check total records
SELECT 'Total withdrawal requests:' as info, COUNT(*) as count 
FROM withdrawal_requests;

-- 3. Check for orphaned records (creator_id not in users table)
SELECT 'Orphaned withdrawal requests (no matching user):' as info, COUNT(*) as count
FROM withdrawal_requests wr
LEFT JOIN users u ON wr.creator_id = u.id
WHERE u.id IS NULL;

-- 4. Check for invalid UUIDs or nulls
SELECT 'Records with invalid creator_id:' as info, COUNT(*) as count
FROM withdrawal_requests 
WHERE creator_id IS NULL;

-- 5. Check data types that might cause casting issues
SELECT 'Sample withdrawal requests data:' as info;
SELECT 
  id,
  creator_id,
  amount,
  method,
  status,
  created_at,
  CASE 
    WHEN creator_id IS NULL THEN 'NULL creator_id'
    ELSE 'Valid'
  END as data_quality
FROM withdrawal_requests 
LIMIT 5;

-- 6. Test the simplified function directly
SELECT 'Testing admin function directly:' as info;
SELECT * FROM admin_get_withdrawal_requests('all', '') LIMIT 1;

-- 7. Check RLS policies on withdrawal_requests
SELECT 'RLS policies on withdrawal_requests:' as info;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'withdrawal_requests';

-- 8. Check if there are any triggers that might interfere
SELECT 'Triggers on withdrawal_requests:' as info;
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'withdrawal_requests';
