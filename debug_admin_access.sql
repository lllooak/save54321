-- Debug admin access issues
-- Check current user's role and create missing admin functions

-- First, check your current user role
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM users 
WHERE id = auth.uid();

-- Check if admin_get_user_super_admin_status function exists
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'admin_get_user_super_admin_status'
);

-- Create the missing admin_get_user_super_admin_status function that the withdrawal page needs
CREATE OR REPLACE FUNCTION admin_get_user_super_admin_status(p_user_id uuid)
RETURNS TABLE (
  is_admin boolean,
  is_super_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN u.role = 'admin' THEN true ELSE false END as is_admin,
    CASE WHEN u.role = 'admin' THEN true ELSE false END as is_super_admin
  FROM users u
  WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_user_super_admin_status TO authenticated;

-- Test the function with your current user
SELECT * FROM admin_get_user_super_admin_status(auth.uid());

-- If your role is not 'admin', update it (replace YOUR_EMAIL with your actual email)
-- UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
