/*
  # Fix admin balance adjustment function

  1. Changes
    - Update admin_adjust_user_balance function to properly handle admin permissions
    - Ensure proper error handling and validation
    - Fix transaction recording
  
  2. Security
    - Maintain security definer attribute
    - Ensure proper permission checks
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS admin_adjust_user_balance;

-- Create updated function with proper admin permission handling
CREATE OR REPLACE FUNCTION admin_adjust_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_reason text DEFAULT 'Manual balance adjustment by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_current_balance numeric;
  v_new_balance numeric;
  v_admin_id uuid;
  v_transaction_id uuid;
  v_admin_role text;
BEGIN
  -- Get the current user ID
  v_admin_id := auth.uid();
  
  -- Check if the current user exists and is an admin
  SELECT role INTO v_admin_role
  FROM users
  WHERE id = v_admin_id;
  
  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'רק מנהלים יכולים לעדכן יתרות משתמשים'
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
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description,
    created_at,
    updated_at
  ) VALUES (
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
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION admin_adjust_user_balance TO authenticated;
