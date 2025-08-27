-- Create function for manual balance adjustment
CREATE OR REPLACE FUNCTION admin_adjust_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Manual balance adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check if executor is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can adjust wallet balances'
    );
  END IF;

  -- Get current balance
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot set balance below 0'
    );
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    id,
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    CASE WHEN p_amount >= 0 THEN 'top_up' ELSE 'deduction' END,
    ABS(p_amount),
    'manual',
    'completed',
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- Update user balance
  UPDATE users
  SET 
    wallet_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the adjustment
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'manual_balance_adjustment',
    'users',
    p_user_id,
    auth.uid(),
    jsonb_build_object(
      'previous_balance', v_current_balance,
      'adjustment_amount', p_amount,
      'new_balance', v_new_balance,
      'transaction_id', v_transaction_id,
      'description', p_description
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'adjustment_amount', p_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Grant execute permission to authenticated users (admin check is done inside function)
GRANT EXECUTE ON FUNCTION admin_adjust_wallet_balance TO authenticated;
