-- Debug withdrawal data loading functions
-- Run this in Supabase SQL Editor

-- 1. Check if withdrawal admin functions exist
SELECT 
  routine_name as function_name,
  routine_type,
  security_type,
  'Function exists' as status
FROM information_schema.routines 
WHERE routine_name IN (
  'admin_get_withdrawal_requests',
  'admin_get_withdrawal_requests_count',
  'admin_update_withdrawal_status'
)
ORDER BY routine_name;

-- 2. Test admin_get_withdrawal_requests_count function
SELECT 'Testing admin_get_withdrawal_requests_count' as test;
-- This should work in SQL Editor (no auth context needed for SECURITY DEFINER)

-- 3. Check withdrawal_requests table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'withdrawal_requests'
ORDER BY ordinal_position;

-- 4. Check if any withdrawal requests exist
SELECT 
  COUNT(*) as total_withdrawals,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM withdrawal_requests;

-- 5. Check RLS policies on withdrawal_requests
SELECT 
  policyname,
  roles,
  cmd as command,
  qual as condition
FROM pg_policies 
WHERE tablename = 'withdrawal_requests';
