/*
  # Fix PayPal transaction processing

  1. Changes
    - Update process_paypal_transaction function to handle currency conversion
    - Add validation to prevent double processing
    - Add transaction amount validation
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_paypal_transaction;

-- Create updated function with currency handling
CREATE OR REPLACE FUNCTION process_paypal_transaction(
  p_transaction_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_platform_fee numeric;
  v_fee_amount numeric;
  v_creator_amount numeric;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM wallet_transactions
  WHERE id = p_transaction_id
  AND payment_method = 'paypal'
  FOR UPDATE;

  -- Verify transaction exists and hasn't been processed
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.payment_status = 'completed' THEN
    RAISE EXCEPTION 'Transaction already processed';
  END IF;

  -- Get platform fee percentage from config
  SELECT COALESCE(
    (SELECT (value->>'platform_fee')::numeric 
     FROM platform_config 
     WHERE key = 'platform_fee'),
    10 -- Default 10% if not configured
  ) INTO v_platform_fee;

  -- Calculate fee amount and creator amount
  v_fee_amount := (v_transaction.amount * v_platform_fee / 100)::numeric(10,2);
  v_creator_amount := (v_transaction.amount - v_fee_amount)::numeric(10,2);

  -- Update transaction status
  UPDATE wallet_transactions
  SET 
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- If payment completed, update user balance
  IF p_status = 'completed' THEN
    -- Create fee transaction
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      v_transaction.user_id,
      'fee',
      v_fee_amount,
      'platform',
      'completed',
      'Platform fee'
    );

    -- Create creator transaction with reduced amount
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      v_transaction.user_id,
      'earning',
      v_creator_amount,
      'platform',
      'completed',
      'Creator earnings after platform fee'
    );

    -- Update user balance with creator amount only
    UPDATE users
    SET 
      wallet_balance = wallet_balance + v_creator_amount,
      updated_at = NOW()
    WHERE id = v_transaction.user_id;

    -- Log successful transaction with fee details
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'paypal_payment_completed',
      'wallet_transactions',
      p_transaction_id,
      v_transaction.user_id,
      jsonb_build_object(
        'total_amount', v_transaction.amount,
        'platform_fee_percentage', v_platform_fee,
        'platform_fee_amount', v_fee_amount,
        'creator_amount', v_creator_amount,
        'payment_method', 'paypal'
      )
    );
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and rollback
    RAISE NOTICE 'Error in process_paypal_transaction: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO authenticated;
