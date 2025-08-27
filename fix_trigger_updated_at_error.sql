-- Fix trigger function to remove invalid updated_at reference from earnings table
-- The earnings table doesn't have an updated_at column, only: id, creator_id, request_id, amount, status, created_at

-- Update the trigger function to fix the updated_at column error
CREATE OR REPLACE FUNCTION update_earnings_and_wallet_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_earnings_record earnings%ROWTYPE;
BEGIN
  -- Only proceed if the request status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Update earnings status to completed (remove invalid updated_at reference)
    UPDATE earnings
    SET 
      status = 'completed'
    WHERE request_id = NEW.id
    RETURNING * INTO v_earnings_record;
    
    -- If we found earnings record, update creator's wallet balance
    IF v_earnings_record IS NOT NULL THEN
      -- Add the earnings amount to the creator's wallet balance
      UPDATE users
      SET 
        wallet_balance = COALESCE(wallet_balance, 0) + v_earnings_record.amount,
        updated_at = NOW()
      WHERE id = v_earnings_record.creator_id;
      
      -- Log the wallet balance update
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        user_id,
        details
      ) VALUES (
        'wallet_balance_updated_from_earnings',
        'users',
        v_earnings_record.creator_id,
        v_earnings_record.creator_id,
        jsonb_build_object(
          'request_id', NEW.id,
          'earnings_id', v_earnings_record.id,
          'earnings_amount', v_earnings_record.amount,
          'completed_at', NOW(),
          'reason', 'earnings_completed'
        )
      );
      
      -- Also create a wallet transaction record for tracking
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        payment_method,
        payment_status,
        description,
        reference_id,
        created_at
      ) VALUES (
        v_earnings_record.creator_id,
        'earnings',
        v_earnings_record.amount,
        'internal',
        'completed',
        'Earnings from completed request: ' || NEW.id,
        NEW.id::text,
        NOW()
      );
    END IF;
    
    -- Log the earnings completion
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'earnings_completed',
      'earnings',
      v_earnings_record.id,
      v_earnings_record.creator_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'earnings_id', v_earnings_record.id,
        'amount', v_earnings_record.amount,
        'completed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger should already exist, but let's ensure it's properly set up
DROP TRIGGER IF EXISTS earnings_wallet_update_trigger ON requests;
CREATE TRIGGER earnings_wallet_update_trigger
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_earnings_and_wallet_on_completion();
