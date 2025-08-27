-- Debug RLS policies on earnings table
-- Run this in Supabase SQL Editor

-- 1. Check if RLS is enabled on earnings table
SELECT 'RLS status on earnings table:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'earnings';

-- 2. List all RLS policies on earnings table
SELECT 'RLS policies on earnings table:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'earnings';

-- 3. Check if creators can SELECT their own earnings (test with a known creator_id)
-- Replace with actual creator_id from recent earnings
SELECT 'Sample earnings with creator info (to test visibility):' as info;
SELECT e.id, e.creator_id, u.email as creator_email, e.amount, e.status, e.created_at
FROM earnings e
LEFT JOIN users u ON e.creator_id = u.id
ORDER BY e.created_at DESC
LIMIT 5;

-- 4. Check earnings table structure to ensure frontend is querying correct columns
SELECT 'Earnings table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'earnings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Test a simple earnings query that frontend would make
SELECT 'Test earnings query (like frontend would do):' as info;
SELECT id, creator_id, request_id, amount, status, created_at
FROM earnings
WHERE creator_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

SELECT 'RLS Debug complete - check if policies allow creator access to their earnings' as result;
