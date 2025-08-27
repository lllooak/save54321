-- Create service role functions for withdrawal management admin operations
-- These functions bypass RLS for admin users to manage withdrawal data

-- Function to get all withdrawal requests with creator details
CREATE OR REPLACE FUNCTION admin_get_withdrawal_requests(
  p_status_filter text DEFAULT 'all',
  p_search_query text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  amount numeric,
  method text,
  paypal_email text,
  bank_details text,
  status text,
  created_at timestamp with time zone,
  processed_at timestamp with time zone,
  creator_name text,
  creator_email text,
  creator_avatar_url text
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
    wr.id,
    wr.creator_id,
    wr.amount,
    wr.method,
    wr.paypal_email,
    wr.bank_details,
    wr.status,
    wr.created_at,
    wr.processed_at,
    COALESCE(cp.name, u.name, u.email, 'לא ידוע') as creator_name,
    u.email as creator_email,
    cp.avatar_url as creator_avatar_url
  FROM withdrawal_requests wr
  LEFT JOIN users u ON wr.creator_id = u.id
  LEFT JOIN creator_profiles cp ON wr.creator_id = cp.user_id
  WHERE 
    (p_status_filter = 'all' OR wr.status = p_status_filter) AND
    (p_search_query = '' OR 
     COALESCE(cp.name, u.name, '') ILIKE '%' || p_search_query || '%' OR
     COALESCE(wr.paypal_email, '') ILIKE '%' || p_search_query || '%')
  ORDER BY wr.created_at DESC;
END;
$$;

-- Function to get withdrawal requests count
CREATE OR REPLACE FUNCTION admin_get_withdrawal_requests_count(
  p_status_filter text DEFAULT 'all'
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
  
  SELECT COUNT(*)::integer INTO request_count
  FROM withdrawal_requests wr
  WHERE (p_status_filter = 'all' OR wr.status = p_status_filter);
    
  RETURN request_count;
END;
$$;

-- Function to update withdrawal request status
CREATE OR REPLACE FUNCTION admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_new_status text
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  withdrawal_record record;
  creator_balance numeric;
BEGIN
  -- Check if user is admin
  SELECT id INTO admin_user_id FROM users 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Validate status
  IF p_new_status NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Must be completed or rejected';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id AND status = 'pending';
  
  IF withdrawal_record IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- If rejecting, add the amount back to creator's balance
  IF p_new_status = 'rejected' THEN
    -- Get current creator balance
    SELECT COALESCE(wallet_balance, 0) INTO creator_balance
    FROM users WHERE id = withdrawal_record.creator_id;
    
    -- Add back the withdrawal amount
    UPDATE users 
    SET wallet_balance = creator_balance + withdrawal_record.amount,
        updated_at = NOW()
    WHERE id = withdrawal_record.creator_id;
    
    -- Create a transaction record for the refund
    INSERT INTO wallet_transactions (
      user_id, type, amount, payment_method, payment_status, description
    ) VALUES (
      withdrawal_record.creator_id,
      'refund',
      withdrawal_record.amount,
      'platform',
      'completed',
      'החזר עקב דחיית בקשת משיכה'
    );
  END IF;
  
  -- Update withdrawal status
  UPDATE withdrawal_requests 
  SET 
    status = p_new_status,
    processed_at = NOW()
  WHERE id = p_withdrawal_id;
  
  -- Log the action
  INSERT INTO audit_logs (
    action, entity, entity_id, user_id, details
  ) VALUES (
    'admin_withdrawal_status_update',
    'withdrawal_requests',
    p_withdrawal_id,
    admin_user_id,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'creator_id', withdrawal_record.creator_id,
      'amount', withdrawal_record.amount,
      'previous_status', withdrawal_record.status,
      'new_status', p_new_status,
      'processed_at', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'withdrawal_id', p_withdrawal_id,
    'status', p_new_status,
    'processed_at', NOW()
  );
END;
$$;

-- Function to get/set minimum withdrawal amount
CREATE OR REPLACE FUNCTION admin_get_min_withdrawal_amount()
RETURNS numeric
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  min_amount numeric;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  SELECT COALESCE(value::numeric, 50) INTO min_amount
  FROM platform_config
  WHERE key = 'min_withdraw_amount';
  
  RETURN min_amount;
END;
$$;

-- Function to update minimum withdrawal amount
CREATE OR REPLACE FUNCTION admin_set_min_withdrawal_amount(p_amount numeric)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  old_amount numeric;
BEGIN
  -- Check if user is admin
  SELECT id INTO admin_user_id FROM users 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;
  
  -- Get old amount
  SELECT COALESCE(value::numeric, 50) INTO old_amount
  FROM platform_config WHERE key = 'min_withdraw_amount';
  
  -- Update or insert the configuration
  INSERT INTO platform_config (key, value)
  VALUES ('min_withdraw_amount', p_amount::text)
  ON CONFLICT (key) 
  DO UPDATE SET value = p_amount::text;
  
  -- Log the change
  INSERT INTO audit_logs (
    action, entity, entity_id, user_id, details
  ) VALUES (
    'admin_update_min_withdraw_amount',
    'platform_config',
    null,
    admin_user_id,
    jsonb_build_object(
      'previous_amount', old_amount,
      'new_amount', p_amount
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_amount', old_amount,
    'new_amount', p_amount
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_withdrawal_requests TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_withdrawal_requests_count TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_withdrawal_status TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_min_withdrawal_amount TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_min_withdrawal_amount TO authenticated;
