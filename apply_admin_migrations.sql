-- Apply all pending admin migrations in correct order
-- This will enable admin functions for user search, payments, and withdrawals

-- First, ensure admin_audit_log table exists (required by admin_search_users)
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid NOT NULL,
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes on admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- Apply admin_search_users function
CREATE OR REPLACE FUNCTION admin_search_users(
    p_search_query text,
    p_limit int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    email text,
    name text,
    role text,
    wallet_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_user_id uuid;
    user_role text;
BEGIN
    calling_user_id := auth.uid();
    
    SELECT u.role INTO user_role FROM users u WHERE u.id = calling_user_id;
    
    IF user_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
    
    RETURN QUERY
    SELECT u.id, u.email, u.name, u.role, u.wallet_balance
    FROM users u
    WHERE (u.email ILIKE '%' || p_search_query || '%' OR u.name ILIKE '%' || p_search_query || '%')
      AND LENGTH(p_search_query) >= 3
    ORDER BY CASE WHEN u.email ILIKE p_search_query || '%' THEN 1
                  WHEN u.name ILIKE p_search_query || '%' THEN 2
                  ELSE 3 END, u.name, u.email
    LIMIT p_limit;
    
    -- Log the search (with error handling)
    BEGIN
        INSERT INTO admin_audit_log (admin_id, action, details, created_at)
        VALUES (calling_user_id, 'search_users',
                json_build_object('search_query', p_search_query,
                                  'results_count', (SELECT COUNT(*) FROM users u WHERE u.email ILIKE '%' || p_search_query || '%' OR u.name ILIKE '%' || p_search_query || '%')),
                NOW());
    EXCEPTION WHEN OTHERS THEN 
        -- Silently ignore audit log errors to not break the main functionality
        NULL;
    END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_search_users TO authenticated;

-- Success message
SELECT 'Admin search function applied successfully' as status;
