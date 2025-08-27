-- Fix wallet_transactions type constraint to include 'earnings'
-- Current constraint only allows: 'top_up', 'purchase', 'refund'
-- We need to add 'earnings' for creator earnings from completed requests

-- Drop the existing check constraint
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Add the new constraint that includes 'earnings'
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings'));

-- Optional: Also update the trigger function to use a more descriptive description
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
      
      -- Create a wallet transaction record for tracking (now with allowed 'earnings' type)
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
        'earnings',  -- This is now allowed
        v_earnings_record.amount,
        'internal',
        'completed',
        'Creator earnings from completed request #' || NEW.id,
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
