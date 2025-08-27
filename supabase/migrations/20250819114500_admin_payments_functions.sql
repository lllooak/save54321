-- Create service role functions for payments and payouts admin operations
-- These functions bypass RLS for admin users to manage payment data

-- Function to get all wallet transactions with user details
CREATE OR REPLACE FUNCTION admin_get_wallet_transactions(
  p_type_filter text DEFAULT 'all',
  p_status_filter text DEFAULT 'all',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  type text,
  amount numeric,
  payment_method text,
  payment_status text,
  description text,
  created_at timestamp with time zone,
  user_email text,
  user_name text,
  user_role text
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
    wt.id,
    wt.user_id,
    wt.type,
    wt.amount,
    wt.payment_method,
    wt.payment_status,
    wt.description,
    wt.created_at,
    COALESCE(u.email, 'משתמש לא קיים') as user_email,
    COALESCE(u.name, u.email, 'משתמש לא קיים') as user_name,
    COALESCE(u.role, 'user') as user_role
  FROM wallet_transactions wt
  LEFT JOIN users u ON wt.user_id = u.id
  WHERE 
    (p_type_filter = 'all' OR wt.type = p_type_filter) AND
    (p_status_filter = 'all' OR wt.payment_status = p_status_filter)
  ORDER BY wt.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get wallet transactions count
CREATE OR REPLACE FUNCTION admin_get_wallet_transactions_count(
  p_type_filter text DEFAULT 'all',
  p_status_filter text DEFAULT 'all'
)
RETURNS integer
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_count integer;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  SELECT COUNT(*)::integer INTO transaction_count
  FROM wallet_transactions wt
  WHERE 
    (p_type_filter = 'all' OR wt.type = p_type_filter) AND
    (p_status_filter = 'all' OR wt.payment_status = p_status_filter);
    
  RETURN transaction_count;
END;
$$;

-- Function to get payment statistics
CREATE OR REPLACE FUNCTION admin_get_payment_stats()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  stats_result jsonb;
  top_up_data record;
  purchase_total numeric;
  refund_total numeric;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get top-up statistics
  SELECT 
    COUNT(*) as total_topups,
    COALESCE(SUM(amount), 0) as total_amount,
    COUNT(DISTINCT user_id) as unique_users
  INTO top_up_data
  FROM wallet_transactions
  WHERE type = 'top_up' AND payment_status = 'completed';
  
  -- Get purchase total
  SELECT COALESCE(SUM(amount), 0) INTO purchase_total
  FROM wallet_transactions
  WHERE type = 'purchase' AND payment_status = 'completed';
  
  -- Get refund total
  SELECT COALESCE(SUM(amount), 0) INTO refund_total
  FROM wallet_transactions
  WHERE type = 'refund' AND payment_status = 'completed';
  
  -- Build stats object
  stats_result := jsonb_build_object(
    'totalTopUps', top_up_data.total_topups,
    'totalAmount', top_up_data.total_amount,
    'averageTopUp', CASE 
      WHEN top_up_data.total_topups > 0 THEN top_up_data.total_amount / top_up_data.total_topups 
      ELSE 0 
    END,
    'activeUsers', top_up_data.unique_users,
    'totalPurchases', purchase_total,
    'totalRefunds', refund_total
  );
  
  RETURN stats_result;
END;
$$;

-- Function to manually update user wallet balance (admin only)
CREATE OR REPLACE FUNCTION admin_update_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_operation text, -- 'add', 'subtract', 'set'
  p_description text
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  old_balance numeric;
  new_balance numeric;
  transaction_id uuid;
BEGIN
  -- Check if user is admin
  SELECT id INTO admin_user_id FROM users 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get current balance
  SELECT COALESCE(wallet_balance, 0) INTO old_balance 
  FROM users WHERE id = p_user_id;
  
  IF old_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Calculate new balance
  CASE p_operation
    WHEN 'add' THEN new_balance := old_balance + p_amount;
    WHEN 'subtract' THEN new_balance := old_balance - p_amount;
    WHEN 'set' THEN new_balance := p_amount;
    ELSE RAISE EXCEPTION 'Invalid operation. Use: add, subtract, or set';
  END CASE;
  
  -- Ensure balance doesn't go negative
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Cannot set negative balance';
  END IF;
  
  -- Update user balance
  UPDATE users 
  SET wallet_balance = new_balance, updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id, type, amount, payment_method, payment_status, description
  ) VALUES (
    p_user_id, 
    CASE WHEN p_operation = 'subtract' THEN 'admin_deduction' ELSE 'admin_adjustment' END,
    ABS(p_amount),
    'admin',
    'completed',
    p_description
  ) RETURNING id INTO transaction_id;
  
  -- Log the action
  INSERT INTO audit_logs (
    action, entity, entity_id, user_id, details
  ) VALUES (
    'admin_balance_update',
    'users',
    p_user_id,
    admin_user_id,
    jsonb_build_object(
      'operation', p_operation,
      'amount', p_amount,
      'previous_balance', old_balance,
      'new_balance', new_balance,
      'description', p_description,
      'transaction_id', transaction_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'user_id', p_user_id,
    'previous_balance', old_balance,
    'new_balance', new_balance,
    'transaction_id', transaction_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_wallet_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_wallet_transactions_count TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_payment_stats TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_balance TO authenticated;
