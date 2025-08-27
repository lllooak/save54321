-- Complete diagnostic check for admin withdrawal functions
-- Run this to see exactly what's missing

-- 1. Check your current user role
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM users 
WHERE id = auth.uid();

-- 2. Check which admin functions exist
SELECT 
  'admin_get_user_super_admin_status' as function_name,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_user_super_admin_status') as exists
UNION ALL
SELECT 
  'admin_get_withdrawal_requests',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_withdrawal_requests')
UNION ALL
SELECT 
  'admin_get_withdrawal_requests_count',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_withdrawal_requests_count')
UNION ALL
SELECT 
  'admin_update_withdrawal_status',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_update_withdrawal_status')
UNION ALL
SELECT 
  'admin_get_min_withdrawal_amount',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_get_min_withdrawal_amount')
UNION ALL
SELECT 
  'admin_set_min_withdrawal_amount',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_set_min_withdrawal_amount');

-- 3. If your role is not 'admin', uncomment and run this (replace YOUR_EMAIL):
-- UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';

-- 4. Test admin_get_user_super_admin_status function if it exists
-- SELECT * FROM admin_get_user_super_admin_status(auth.uid());
