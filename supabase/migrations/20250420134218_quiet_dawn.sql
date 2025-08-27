/*
  # Fix PayPal balance doubling issue

  1. Changes
    - Update process_paypal_transaction function to prevent double balance updates
    - Add transaction reference tracking to prevent duplicate processing
    - Improve error handling and logging
  
  2. Security
    - Maintain existing security measures
    - Add additional validation checks
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_paypal_transaction;

-- Create updated function with fixed balance handling
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
  v_duplicate_check integer;
BEGIN
  -- Check for duplicate processing by looking for reference to this transaction
  SELECT COUNT(*) INTO v_duplicate_check
  FROM wallet_transactions
  WHERE reference_id = p_transaction_id::text
  AND payment_status = 'completed';
  
  IF v_duplicate_check > 0 THEN
    RAISE EXCEPTION 'Transaction already processed via reference';
  END IF;

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

  -- Get current balance with row lock
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM users
  WHERE id = v_transaction.user_id
  FOR UPDATE;

  -- Calculate new balance - ONLY add the exact transaction amount
  v_new_balance := v_current_balance + v_transaction.amount;

  -- Begin atomic updates
  BEGIN
    -- Update transaction status first
    UPDATE wallet_transactions
    SET 
      payment_status = p_status,
      updated_at = NOW()
    WHERE id = p_transaction_id;

    -- If payment completed, update user balance
    IF p_status = 'completed' THEN
      -- Update user's wallet balance with exact transaction amount
      UPDATE users
      SET 
        wallet_balance = v_new_balance,
        updated_at = NOW()
      WHERE id = v_transaction.user_id;

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
    END IF;

    RETURN TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log detailed error information
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        user_id,
        details
      ) VALUES (
        'paypal_payment_error',
        'wallet_transactions',
        p_transaction_id,
        v_transaction.user_id,
        jsonb_build_object(
          'error', SQLERRM,
          'error_detail', SQLSTATE,
          'amount', v_transaction.amount,
          'attempted_at', NOW()
        )
      );
      RETURN FALSE;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO authenticated;
