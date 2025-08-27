-- Create service role functions for request management admin operations
-- These functions bypass RLS for admin users to manage request data

-- Function to get all requests with creator and fan details
CREATE OR REPLACE FUNCTION admin_get_all_requests(
  p_status_filter text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_order_by text DEFAULT 'newest'
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  fan_id uuid,
  request_type text,
  status text,
  price numeric,
  message text,
  deadline timestamp with time zone,
  created_at timestamp with time zone,
  video_url text,
  recipient text,
  creator_name text,
  fan_name text
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
  SELECT 
    r.id,
    r.creator_id,
    r.fan_id,
    r.request_type,
    r.status,
    r.price,
    r.message,
    r.deadline,
    r.created_at,
    r.video_url,
    r.recipient,
    COALESCE(cp.name, 'לא ידוע') as creator_name,
    COALESCE(u.name, u.email, 'לא ידוע') as fan_name
  FROM requests r
  LEFT JOIN creator_profiles cp ON r.creator_id = cp.id
  LEFT JOIN users u ON r.fan_id = u.id
  WHERE (p_status_filter IS NULL OR r.status = p_status_filter)
  ORDER BY 
    CASE 
      WHEN p_order_by = 'oldest' THEN r.created_at
      ELSE NULL
    END ASC,
    CASE 
      WHEN p_order_by = 'newest' THEN r.created_at
      ELSE NULL
    END DESC
  LIMIT p_limit;
END;
$$;

-- Function to get requests count by status
CREATE OR REPLACE FUNCTION admin_get_requests_count(
  p_status_filter text DEFAULT NULL
)
RETURNS integer
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  request_count integer;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  SELECT COUNT(*)
  INTO request_count
  FROM requests r
  WHERE (p_status_filter IS NULL OR r.status = p_status_filter);
  
  RETURN request_count;
END;
$$;

-- Function to get single request details with user info
CREATE OR REPLACE FUNCTION admin_get_request_details(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  fan_id uuid,
  request_type text,
  status text,
  price numeric,
  message text,
  deadline timestamp with time zone,
  created_at timestamp with time zone,
  video_url text,
  recipient text
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
  SELECT 
    r.id,
    r.creator_id,
    r.fan_id,
    r.request_type,
    r.status,
    r.price,
    r.message,
    r.deadline,
    r.created_at,
    r.video_url,
    r.recipient
  FROM requests r
  WHERE r.id = p_request_id;
END;
$$;

-- Function to update request status
CREATE OR REPLACE FUNCTION admin_update_request_status(
  p_request_id uuid,
  p_new_status text
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  old_status text;
  admin_user_id uuid;
BEGIN
  -- Check if user is admin
  SELECT id INTO admin_user_id FROM users 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get current status
  SELECT status INTO old_status FROM requests WHERE id = p_request_id;
  
  IF old_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Update the status
  UPDATE requests 
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Log the action
  INSERT INTO audit_logs (
    action, entity, entity_id, user_id, details
  ) VALUES (
    'admin_update_request_status',
    'requests',
    p_request_id,
    admin_user_id,
    jsonb_build_object(
      'previous_status', old_status,
      'new_status', p_new_status,
      'timestamp', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'request_id', p_request_id, 
    'old_status', old_status,
    'new_status', p_new_status
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_all_requests TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_requests_count TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_request_details TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_request_status TO authenticated;
