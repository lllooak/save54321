/*
  # Update platform fee to 30% and modify payment processing

  1. Changes
    - Set default platform fee to 30%
    - Update process_request_payment function to handle the 30% fee
    - Ensure creators receive 70% of the payment amount

  2. Security
    - Maintain existing security measures
    - No changes to RLS policies
*/

-- Update platform fee to 30%
UPDATE platform_config
SET value = to_jsonb(30)
WHERE key = 'platform_fee';

-- Insert platform fee if it doesn't exist
INSERT INTO platform_config (key, value)
VALUES ('platform_fee', to_jsonb(30))
ON CONFLICT (key) DO NOTHING;

-- Drop existing function
DROP FUNCTION IF EXISTS process_request_payment;

-- Create updated function with 30% platform fee
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
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
  v_fan_balance numeric;
  v_admin_id uuid;
BEGIN
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

    -- Add creator's share to their wallet (70% of the amount)
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
      'Video request earning (70% of payment)'
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
        'Platform fee (30% of payment)'
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
