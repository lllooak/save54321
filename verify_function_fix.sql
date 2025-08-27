-- Verify function fix was applied correctly
-- Run this in Supabase SQL Editor

-- 1. Check if function exists and its return type
SELECT 
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'admin_get_user_super_admin_status'
AND n.nspname = 'public';

-- 2. Test the function with current user
SELECT admin_get_user_super_admin_status(auth.uid());

-- 3. Check current user's role
SELECT id, email, role, is_super_admin 
FROM users 
WHERE id = auth.uid();

-- 4. Check current session
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;
