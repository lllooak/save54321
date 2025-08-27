-- COMPLETE FIX FOR PAYPAL DOUBLE BALANCE ISSUE
-- This script fixes the double charging bug by ensuring only the trigger updates the wallet balance

-- 1. First, apply the corrected function that removes duplicate wallet updates
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
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF v_transaction.payment_status = 'completed' THEN
    RAISE EXCEPTION 'Transaction already processed: %', p_transaction_id;
  END IF;

  -- Update transaction status ONLY
  -- The wallet balance will be updated automatically by the trigger
  UPDATE wallet_transactions
  SET 
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Log successful transaction
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

-- 2. Ensure the proper wallet balance trigger is in place
CREATE OR REPLACE FUNCTION update_wallet_balance_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update balance when transaction is completed
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    UPDATE users
    SET wallet_balance = wallet_balance + NEW.amount
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop any existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_wallet_balance_trigger ON wallet_transactions;
DROP TRIGGER IF EXISTS update_wallet_balance_trigger_safe ON wallet_transactions;
DROP TRIGGER IF EXISTS update_wallet_balance_trigger_with_audit ON wallet_transactions;

-- Create the proper trigger
CREATE TRIGGER update_wallet_balance_trigger
    AFTER UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_balance_from_transaction();

-- 3. Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO service_role;
GRANT EXECUTE ON FUNCTION process_paypal_transaction TO authenticated;

-- 4. Clean up emergency debugging (optional - run after testing)
-- DROP TABLE IF EXISTS emergency_wallet_audit;
-- DROP TRIGGER IF EXISTS emergency_wallet_audit_trigger ON users;
-- DROP FUNCTION IF EXISTS emergency_audit_wallet_changes();

COMMENT ON FUNCTION process_paypal_transaction IS 'Processes PayPal transactions without duplicate wallet updates - fixed version';
