-- Check if withdrawal_requests table exists
-- Run this in Supabase SQL Editor

-- 1. Check if withdrawal_requests table exists at all
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'withdrawal_requests';

-- 2. If it doesn't exist, list all tables that contain 'withdrawal' in the name
SELECT 
  table_name,
  table_type,
  'Tables containing withdrawal' as info
FROM information_schema.tables 
WHERE table_name ILIKE '%withdrawal%';

-- 3. Check if we need to create the withdrawal_requests table
SELECT 'Need to create withdrawal_requests table' as action_needed;
