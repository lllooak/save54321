/*
  # Add admin balance management functionality

  1. Changes
    - Create function for admins to adjust user balances
    - Add audit logging for balance adjustments
    - Add transaction records for balance changes
  
  2. Security
    - Only admins can adjust balances
    - All changes are logged for accountability
*/

-- Create function for admins to adjust user balances
CREATE OR REPLACE FUNCTION admin_adjust_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_reason text DEFAULT 'Manual balance adjustment by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_current_balance numeric;
  v_new_balance numeric;
  v_admin_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Check if executor is admin
  SELECT id INTO v_admin_id
  FROM users
  WHERE id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can adjust user balances'
    );
  END IF;

  -- Get user details
  SELECT id, email, name, role, wallet_balance
  INTO v_user_record
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Store current balance
  v_current_balance := COALESCE(v_user_record.wallet_balance, 0);
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot set balance below zero',
      'current_balance', v_current_balance,
      'requested_adjustment', p_amount,
      'minimum_allowed_adjustment', -v_current_balance
    );
  END IF;
  
  -- Update user balance
  UPDATE users
  SET 
    wallet_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    id,
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    CASE 
      WHEN p_amount > 0 THEN 'top_up'
      ELSE 'purchase'
    END,
    ABS(p_amount),
    'admin',
    'completed',
    p_reason,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  -- Log the adjustment in audit logs
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'admin_balance_adjustment',
    'users',
    p_user_id,
    v_admin_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'user_email', v_user_record.email,
      'user_name', v_user_record.name,
      'user_role', v_user_record.role,
      'previous_balance', v_current_balance,
      'adjustment_amount', p_amount,
      'new_balance', v_new_balance,
      'reason', p_reason,
      'transaction_id', v_transaction_id,
      'admin_id', v_admin_id
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'user_email', v_user_record.email,
    'user_name', v_user_record.name,
    'user_role', v_user_record.role,
    'previous_balance', v_current_balance,
    'adjustment_amount', p_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure response
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'admin_balance_adjustment_error',
      'users',
      p_user_id,
      v_admin_id,
      jsonb_build_object(
        'error', SQLERRM,
        'user_id', p_user_id,
        'adjustment_amount', p_amount,
        'reason', p_reason
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION admin_adjust_user_balance TO authenticated;
