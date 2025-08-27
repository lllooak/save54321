-- Create or replace the function to process refunds when a request is declined
CREATE OR REPLACE FUNCTION process_request_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_fan_id uuid;
  v_creator_id uuid;
  v_amount numeric;
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
  v_admin_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Only process when status changes to declined
  IF (NEW.status = 'declined' AND OLD.status != 'declined') THEN
    -- Get request details
    SELECT 
      fan_id, 
      creator_id, 
      price
    INTO 
      v_fan_id, 
      v_creator_id, 
      v_amount
    FROM requests
    WHERE id = NEW.id;
    
    -- Calculate fee and creator amounts
    v_fee_amount := (v_amount * v_platform_fee / 100)::numeric(10,2);
    v_creator_amount := (v_amount - v_fee_amount)::numeric(10,2);
    
    -- Get admin user id
    SELECT id INTO v_admin_id
    FROM users
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Process the refund
    
    -- Refund full amount to fan
    UPDATE users
    SET 
      wallet_balance = wallet_balance + v_amount,
      updated_at = NOW()
    WHERE id = v_fan_id;
    
    -- Create refund transaction record for fan
    INSERT INTO wallet_transactions (
      id,
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      gen_random_uuid(),
      v_fan_id,
      'refund',
      v_amount,
      'wallet',
      'completed',
      'Refund for declined video request',
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Log the refund processing
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'process_refund',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'total_amount', v_amount,
        'fan_id', v_fan_id,
        'creator_id', v_creator_id,
        'reason', 'Request declined by creator',
        'transaction_id', v_transaction_id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'refund_error',
      'requests',
      NEW.id,
      jsonb_build_object(
        'error', SQLERRM,
        'request_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
    
    -- Continue with the update even if refund fails
    -- This prevents blocking the status change
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS request_status_change_trigger ON requests;

-- Create trigger to automatically process refunds
CREATE TRIGGER request_status_change_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_refund();
