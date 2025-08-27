-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_paypal_transaction;

-- Create updated function with improved balance update handling
CREATE OR REPLACE FUNCTION process_paypal_transaction(
  p_transaction_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction RECORD;
  v_current_balance numeric;
  v_new_balance numeric;
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

  -- Get and lock the user record
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM users
  WHERE id = v_transaction.user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_current_balance + v_transaction.amount;

  -- Begin atomic updates
  BEGIN
    -- Update user's wallet balance FIRST
    UPDATE users
    SET 
      wallet_balance = v_new_balance,
      updated_at = NOW()
    WHERE id = v_transaction.user_id;

    -- Then update transaction status
    UPDATE wallet_transactions
    SET 
      payment_status = p_status,
      updated_at = NOW()
    WHERE id = p_transaction_id;

    -- Log successful transaction with detailed balance information
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
        'previous_balance', v_current_balance,
        'new_balance', v_new_balance,
        'payment_method', 'paypal',
        'transaction_time', NOW()
      )
    );

    -- Create a balance update notification record
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_transaction.user_id,
      'top_up',
      v_transaction.amount,
      'paypal',
      'completed',
      'PayPal payment completed',
      p_transaction_id::text
    );

    RETURN TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and rollback
      RAISE NOTICE 'Error in process_paypal_transaction: %', SQLERRM;
      RETURN FALSE;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO authenticated;

-- Ensure indexes exist for better performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_method_status 
ON wallet_transactions(payment_method, payment_status);

CREATE INDEX IF NOT EXISTS idx_users_wallet_balance 
ON users(wallet_balance) 
WHERE wallet_balance IS NOT NULL;
