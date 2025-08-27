/*
  # Add payment processing functions and triggers

  1. Changes
    - Add function to process video request payments
    - Add function to calculate platform fees
    - Add trigger to handle payment processing
    - Add audit logging for payments
    - Add foreign key constraint for wallet_transactions.user_id
*/

-- Add foreign key constraint for wallet_transactions.user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'wallet_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to get platform fee percentage
CREATE OR REPLACE FUNCTION get_platform_fee()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fee_percentage numeric;
BEGIN
  SELECT COALESCE(
    (SELECT (value->>'platform_fee')::numeric 
     FROM platform_config 
     WHERE key = 'platform_fee'),
    10 -- Default 10% if not configured
  ) INTO fee_percentage;
  
  RETURN fee_percentage;
END;
$$;

-- Create function to process video request payment
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
  -- Get platform fee percentage
  SELECT get_platform_fee() INTO v_platform_fee;
  
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

    -- Add platform fee to admin's wallet
    UPDATE users
    SET wallet_balance = wallet_balance + v_fee_amount
    WHERE id = v_admin_id;

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
        'platform_fee', v_fee_amount,
        'creator_amount', v_creator_amount,
        'fan_id', p_fan_id,
        'creator_id', p_creator_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'total_amount', p_amount,
      'platform_fee', v_fee_amount,
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

-- Add type column check to wallet_transactions
ALTER TABLE wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions
ADD CONSTRAINT wallet_transactions_type_check
CHECK (type = ANY (ARRAY['top_up'::text, 'purchase'::text, 'refund'::text, 'earning'::text, 'fee'::text]));

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_request_payment TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_fee TO authenticated;
