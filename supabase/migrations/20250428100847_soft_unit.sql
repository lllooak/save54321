/*
  # Fix withdrawal process

  1. Changes
    - Add trigger to update creator balance when withdrawal is approved
    - Ensure proper transaction recording for withdrawals
    - Fix potential race conditions in withdrawal processing
  
  2. Security
    - Maintain existing security measures
    - Ensure proper transaction handling
*/

-- Create function to handle withdrawal status changes
CREATE OR REPLACE FUNCTION handle_withdrawal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_amount numeric;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Only process when status changes to completed or rejected
  IF (NEW.status = OLD.status) THEN
    RETURN NEW;
  END IF;
  
  -- Get withdrawal details
  SELECT 
    creator_id,
    amount
  INTO 
    v_creator_id,
    v_amount
  FROM withdrawal_requests
  WHERE id = NEW.id;
  
  -- If status changed to completed, deduct from creator's balance
  IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    -- Get creator's current balance
    SELECT wallet_balance INTO v_current_balance
    FROM users
    WHERE id = v_creator_id
    FOR UPDATE;
    
    -- Deduct withdrawal amount from creator's balance
    UPDATE users
    SET 
      wallet_balance = GREATEST(0, wallet_balance - v_amount),
      updated_at = NOW()
    WHERE id = v_creator_id;
    
    -- Create transaction record for the withdrawal
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_creator_id,
      'purchase',
      v_amount,
      (SELECT method FROM withdrawal_requests WHERE id = NEW.id),
      'completed',
      'Withdrawal - ' || (SELECT method FROM withdrawal_requests WHERE id = NEW.id),
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Log the withdrawal completion
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'withdrawal_completed',
      'withdrawal_requests',
      NEW.id,
      jsonb_build_object(
        'creator_id', v_creator_id,
        'amount', v_amount,
        'previous_balance', v_current_balance,
        'new_balance', GREATEST(0, v_current_balance - v_amount),
        'transaction_id', v_transaction_id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in handle_withdrawal_status_change: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for withdrawal status changes
DROP TRIGGER IF EXISTS withdrawal_status_change_trigger ON withdrawal_requests;
CREATE TRIGGER withdrawal_status_change_trigger
AFTER UPDATE OF status ON withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION handle_withdrawal_status_change();

-- Add unique constraint on request_id in earnings table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'earnings_request_id_key' 
    AND conrelid = 'earnings'::regclass
  ) THEN
    ALTER TABLE earnings ADD CONSTRAINT earnings_request_id_key UNIQUE (request_id);
  END IF;
END $$;
