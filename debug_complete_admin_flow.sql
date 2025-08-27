-- Complete debug of admin withdrawal access flow
-- Run this LOGGED IN to your actual website, not Supabase dashboard

-- Test 1: Check if you have a session
SELECT 
  CASE WHEN auth.uid() IS NULL THEN 'NO SESSION - NOT LOGGED IN' ELSE 'SESSION EXISTS' END as session_status,
  auth.uid() as user_id;

-- Test 2: Check your user details and role
SELECT 
  id, 
  email, 
  name, 
  role,
  CASE WHEN role = 'admin' THEN 'ADMIN ROLE OK' ELSE 'NOT ADMIN - THIS IS THE PROBLEM' END as role_status
FROM users 
WHERE id = auth.uid();

-- Test 3: Test the admin function exactly as frontend calls it
SELECT 
  'TESTING admin_get_user_super_admin_status' as test_name;

-- Test 4: Call the function with your user ID
SELECT * FROM admin_get_user_super_admin_status(auth.uid());

-- Test 5: Manual check if you should have admin access
SELECT 
  id,
  email,
  role,
  CASE 
    WHEN role = 'admin' THEN 'YOU SHOULD HAVE ADMIN ACCESS'
    ELSE 'NO ADMIN ACCESS - NEED TO UPDATE ROLE'
  END as expected_access
FROM users 
WHERE id = auth.uid();

-- If your role is NOT 'admin', run this:
-- UPDATE users SET role = 'admin' WHERE id = auth.uid();
