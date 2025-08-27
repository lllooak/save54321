-- Debug real-time admin access check
-- Test the exact function call that the withdrawal page uses

-- Test the admin function exactly as the page calls it
SELECT * FROM admin_get_user_super_admin_status(auth.uid());

-- Check what the session actually contains
SELECT 
  auth.uid() as current_user_id,
  'Session info' as info;

-- Check user in database directly
SELECT 
  id,
  email,
  name,  
  role,
  created_at,
  'Database user info' as info
FROM users 
WHERE id = auth.uid();

-- Test if there's a session issue by checking if auth.uid() returns null
SELECT 
  CASE 
    WHEN auth.uid() IS NULL THEN 'No session - user not logged in'
    ELSE 'Session exists'
  END as session_status;

-- Manual admin check as backup
SELECT 
  id,
  email,
  role,
  CASE WHEN role = 'admin' THEN 'Should have admin access' ELSE 'No admin access' END as access_status
FROM users 
WHERE id = auth.uid();
