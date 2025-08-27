-- Fix admin_get_user_super_admin_status function to return expected format
-- Frontend expects: { is_admin: boolean, is_super_admin: boolean }

CREATE OR REPLACE FUNCTION admin_get_user_super_admin_status(p_user_id uuid)
RETURNS TABLE (
  is_admin boolean,
  is_super_admin boolean
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN u.role = 'admin' THEN true ELSE false END as is_admin,
    COALESCE(u.is_super_admin, false) as is_super_admin
  FROM users u
  WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_user_super_admin_status TO authenticated;
