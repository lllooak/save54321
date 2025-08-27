/*
  # Fix platform fee calculation in payment processing

  1. Changes
    - Update process_request_payment function to correctly read platform fee from platform_config
    - Ensure platform fee is properly applied to transactions
    - Fix balance calculations for all parties involved

  2. Security
    - Maintain existing security measures
    - Ensure proper transaction handling
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_request_payment;

-- Create updated function with correct platform fee handling
CREATE OR REPLACE FUNCTION process_request_payment(
  p_request_id uuid,
  p_fan_id uuid,
  p_creator_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_fee numeric;
  v_fee_amount numeric;
  v_creator_amount numeric;
  v_fan_balance numeric;
  v_admin_id uuid;
BEGIN
  -- Get platform fee percentage from platform_config
  SELECT COALESCE(
    (SELECT (value->>'platform_fee')::numeric 
     FROM platform_config 
     WHERE key = 'platform_fee'),
    10 -- Default 10% if not configured
  ) INTO v_platform_fee;
  
  -- Calculate fee and creator amounts
  v_fee_amount := (p_amount * v_platform_fee / 100)::numeric(10,2);
  v_creator_amount := (p_amount - v_fee_amount)::numeric(10,2);

  -- Get fan's current balance
  SELECT wallet_balance INTO v_fan_balance
  FROM users
  WHERE id = p_fan_id
  FOR UPDATE;

  -- Check if fan has sufficient balance
  IF v_fan_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Get admin user id
  SELECT id INTO v_admin_id
  FROM users
  WHERE role = 'admin'
  LIMIT 1;

  -- Begin transaction
  BEGIN
    -- Deduct amount from fan's wallet
    UPDATE users
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_fan_id;

    -- Add creator's share to their wallet
    UPDATE users
    SET wallet_balance = wallet_balance + v_creator_amount
    WHERE id = p_creator_id;

    -- Add platform fee to admin's wallet if admin exists
    IF v_admin_id IS NOT NULL THEN
      UPDATE users
      SET wallet_balance = wallet_balance + v_fee_amount
      WHERE id = v_admin_id;
    END IF;

    -- Create transaction records
    -- Fan's purchase transaction
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      p_fan_id,
      'purchase',
      p_amount,
      'wallet',
      'completed',
      'Video request payment'
    );

    -- Creator's earning transaction
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      p_creator_id,
      'earning',
      v_creator_amount,
      'platform',
      'completed',
      'Video request earning'
    );

    -- Admin's fee transaction
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        payment_method,
        payment_status,
        description
      ) VALUES (
        v_admin_id,
        'fee',
        v_fee_amount,
        'platform',
        'completed',
        'Platform fee'
      );
    END IF;

    -- Create earnings record
    INSERT INTO earnings (
      creator_id,
      request_id,
      amount,
      status
    ) VALUES (
      p_creator_id,
      p_request_id,
      v_creator_amount,
      'completed'
    );

    -- Update request status
    UPDATE requests
    SET status = 'pending'
    WHERE id = p_request_id;

    -- Log the payment processing
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'process_payment',
      'requests',
      p_request_id,
      p_fan_id,
      jsonb_build_object(
        'total_amount', p_amount,
        'platform_fee_percentage', v_platform_fee,
        'platform_fee_amount', v_fee_amount,
        'creator_amount', v_creator_amount,
        'fan_id', p_fan_id,
        'creator_id', p_creator_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'total_amount', p_amount,
      'platform_fee_percentage', v_platform_fee,
      'platform_fee_amount', v_fee_amount,
      'creator_amount', v_creator_amount
    );
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Error in process_request_payment: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_request_payment TO authenticated;
