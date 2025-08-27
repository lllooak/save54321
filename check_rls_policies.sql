-- Check RLS policies that might be blocking admin access
-- Run this in Supabase SQL Editor

-- 1. Check RLS status on key tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  'RLS Status' as info
FROM pg_tables 
WHERE tablename IN ('users', 'withdrawal_requests', 'admin_audit_log')
ORDER BY tablename;

-- 2. Check all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd as command,
  qual as condition,
  'Users table policies' as info
FROM pg_policies 
WHERE tablename = 'users';

-- 3. Check all policies on withdrawal_requests table
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd as command,
  qual as condition,
  'Withdrawal requests policies' as info
FROM pg_policies 
WHERE tablename = 'withdrawal_requests';

-- 4. Check if admin functions have proper SECURITY DEFINER
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proowner::regrole as owner,
  'Function security status' as info
FROM pg_proc 
WHERE proname LIKE 'admin_%'
ORDER BY proname;

-- 5. Test direct access to users table (this might fail due to RLS)
SELECT 
  'Testing direct user access' as test,
  id,
  email,
  role
FROM users 
WHERE id = auth.uid()
LIMIT 1;
