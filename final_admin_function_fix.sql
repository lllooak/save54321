-- Final admin function fix - apply in Supabase SQL Editor
-- This fixes the return type mismatch causing access denied

DROP FUNCTION IF EXISTS admin_get_user_super_admin_status(uuid);

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

GRANT EXECUTE ON FUNCTION admin_get_user_super_admin_status TO authenticated;

-- Verify function was created correctly
SELECT 
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'admin_get_user_super_admin_status'
AND n.nspname = 'public';
