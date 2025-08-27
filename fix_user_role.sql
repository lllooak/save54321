-- Fix user role for admin access
-- Run this in your Supabase SQL Editor

-- Step 1: Check your current user details
SELECT 
  id,
  email,
  name,
  role,
  'Current user details' as info
FROM users 
WHERE id = auth.uid();

-- Step 2: Update your role to admin (this will work for any email)
UPDATE users 
SET role = 'admin' 
WHERE id = auth.uid();

-- Step 3: Verify the update worked
SELECT 
  id,
  email,
  name,
  role,
  'After update' as info
FROM users 
WHERE id = auth.uid();

-- Step 4: Test the admin function
SELECT 
  *,
  'Admin function test' as info
FROM admin_get_user_super_admin_status(auth.uid());

-- Success message
SELECT 'User role updated to admin successfully - try accessing בקשות משיכה now' as status;
