-- Admin function to search users for wallet balance management
-- This function allows admins to search for users by name or email

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
    -- Get the calling user's ID
    calling_user_id := auth.uid();
    
    -- Check if user exists and get their role
    SELECT u.role INTO user_role
    FROM users u 
    WHERE u.id = calling_user_id;
    
    -- Verify caller is admin
    IF user_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
    
    -- Return users matching search query
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.wallet_balance
    FROM users u
    WHERE 
        (u.email ILIKE '%' || p_search_query || '%' OR u.name ILIKE '%' || p_search_query || '%')
        AND LENGTH(p_search_query) >= 3
    ORDER BY 
        CASE 
            WHEN u.email ILIKE p_search_query || '%' THEN 1
            WHEN u.name ILIKE p_search_query || '%' THEN 2
            ELSE 3
        END,
        u.name, u.email
    LIMIT p_limit;
    
    -- Log admin action
    INSERT INTO admin_audit_log (admin_id, action, details, created_at)
    VALUES (
        calling_user_id,
        'search_users',
        json_build_object(
            'search_query', p_search_query,
            'results_count', (SELECT COUNT(*) FROM users u WHERE u.email ILIKE '%' || p_search_query || '%' OR u.name ILIKE '%' || p_search_query || '%')
        ),
        NOW()
    );
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION admin_search_users TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_search_users IS 'Admin function to search users by name or email for wallet balance management';
