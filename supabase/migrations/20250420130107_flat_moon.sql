-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_paypal_transaction;

-- Create updated function with immediate balance update
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
  v_current_balance numeric;
BEGIN
  -- Get transaction details with FOR UPDATE to prevent concurrent modifications
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

  -- Get current balance
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = v_transaction.user_id
  FOR UPDATE;

  -- Update transaction status
  UPDATE wallet_transactions
  SET 
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- If payment completed, update user balance immediately
  IF p_status = 'completed' THEN
    -- Update user's wallet balance
    UPDATE users
    SET 
      wallet_balance = COALESCE(v_current_balance, 0) + v_transaction.amount,
      updated_at = NOW()
    WHERE id = v_transaction.user_id;

    -- Log successful transaction
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
        'amount', v_transaction.amount,
        'previous_balance', COALESCE(v_current_balance, 0),
        'new_balance', COALESCE(v_current_balance, 0) + v_transaction.amount,
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
