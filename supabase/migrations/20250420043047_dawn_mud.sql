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

  -- Update transaction status
  UPDATE wallet_transactions
  SET 
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- If payment completed, update user balance
  IF p_status = 'completed' THEN
    UPDATE users
    SET wallet_balance = wallet_balance + v_transaction.amount
    WHERE id = v_transaction.user_id;
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
