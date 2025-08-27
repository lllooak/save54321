-- Create service role functions for admin dashboard statistics
-- These functions bypass RLS for admin users to get platform metrics

-- Function to get dashboard overview statistics
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  total_users integer;
  active_creators integer;
  total_requests integer;
  total_revenue numeric;
  total_wallet_balance numeric;
  pending_videos integer;
  new_creators integer;
  active_disputes integer;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get total users count
  SELECT COUNT(*) INTO total_users FROM users;
  
  -- Get active creators count
  SELECT COUNT(*) INTO active_creators FROM creator_profiles;
  
  -- Get total requests count
  SELECT COUNT(*) INTO total_requests FROM requests;
  
  -- Get total revenue (sum of completed transactions)
  SELECT COALESCE(SUM(amount), 0) INTO total_revenue 
  FROM wallet_transactions 
  WHERE payment_status = 'completed' AND type = 'purchase';
  
  -- Get total wallet balance across all users
  SELECT COALESCE(SUM(wallet_balance), 0) INTO total_wallet_balance FROM users;
  
  -- Get pending video requests count
  SELECT COUNT(*) INTO pending_videos 
  FROM requests 
  WHERE status = 'pending';
  
  -- Get new creators in last 24 hours
  SELECT COUNT(*) INTO new_creators 
  FROM creator_profiles 
  WHERE created_at >= NOW() - INTERVAL '24 hours';
  
  -- Get active disputes count (handle missing table gracefully)
  BEGIN
    SELECT COUNT(*) INTO active_disputes 
    FROM support_tickets 
    WHERE status = 'open';
  EXCEPTION
    WHEN undefined_table THEN
      active_disputes := 0;
  END;
  
  -- Build result JSON
  result := jsonb_build_object(
    'totalUsers', total_users,
    'activeCreators', active_creators,
    'totalRequests', total_requests,
    'totalRevenue', total_revenue,
    'totalWalletBalance', total_wallet_balance,
    'pendingApprovals', jsonb_build_object(
      'creators', new_creators,
      'videos', pending_videos,
      'disputes', active_disputes
    )
  );
  
  RETURN result;
END;
$$;

-- Function to get recent user signups
CREATE OR REPLACE FUNCTION admin_get_recent_signups(p_limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  created_at timestamp with time zone
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY 
  SELECT u.id, u.name, u.email, u.role, u.created_at
  FROM users u
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get user super admin status
CREATE OR REPLACE FUNCTION admin_get_user_super_admin_status(p_user_id uuid)
RETURNS boolean
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  is_super_admin boolean;
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get super admin status for the specified user
  SELECT COALESCE(u.is_super_admin, false) INTO is_super_admin
  FROM users u
  WHERE u.id = p_user_id;
  
  RETURN COALESCE(is_super_admin, false);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_recent_signups TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_super_admin_status TO authenticated;
