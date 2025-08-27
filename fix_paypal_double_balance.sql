-- Fix PayPal balance doubling by removing duplicate wallet balance update from function
-- This ensures only the trigger updates the balance, not both trigger AND function

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

  -- Update transaction status ONLY
  -- The wallet balance will be updated automatically by the trigger
  UPDATE wallet_transactions
  SET 
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Log successful transaction (optional)
  IF p_status = 'completed' THEN
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details,
      created_at
    ) VALUES (
      'paypal_payment_completed',
      'wallet_transaction',
      p_transaction_id,
      v_transaction.user_id,
      jsonb_build_object(
        'amount', v_transaction.amount,
        'method', 'paypal',
        'status', p_status
      ),
      NOW()
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO service_role;
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO authenticated;
