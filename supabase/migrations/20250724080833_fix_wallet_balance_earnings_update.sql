-- Fix for wallet_balance not updating when earnings are completed
-- This solves the "זמין למשיכה" not updating issue in creator dashboard

-- First, let's create/update the function to handle earnings completion with wallet balance update
CREATE OR REPLACE FUNCTION update_earnings_and_wallet_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_earnings_record RECORD;
  v_total_earnings NUMERIC;
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    
    -- Update earnings status to completed
    UPDATE earnings
    SET 
      status = 'completed',
      updated_at = NOW()
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
      NEW.creator_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'creator_id', NEW.creator_id,
        'earnings_amount', v_earnings_record.amount,
        'completed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace the existing trigger with the updated function
DROP TRIGGER IF EXISTS update_earnings_on_completion_trigger ON requests;
CREATE TRIGGER update_earnings_and_wallet_on_completion_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION update_earnings_and_wallet_on_completion();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_earnings_and_wallet_on_completion TO authenticated;

-- Backfill: Update wallet balances for any existing completed earnings that might not have been reflected
-- This is a one-time fix for existing data
DO $$
DECLARE
  v_creator RECORD;
  v_total_completed_earnings NUMERIC;
  v_current_wallet_balance NUMERIC;
  v_expected_wallet_balance NUMERIC;
BEGIN
  -- For each creator with completed earnings
  FOR v_creator IN 
    SELECT DISTINCT creator_id 
    FROM earnings 
    WHERE status = 'completed'
  LOOP
    -- Calculate total completed earnings
    SELECT COALESCE(SUM(amount), 0) INTO v_total_completed_earnings
    FROM earnings
    WHERE creator_id = v_creator.creator_id AND status = 'completed';
    
    -- Get current wallet balance
    SELECT COALESCE(wallet_balance, 0) INTO v_current_wallet_balance
    FROM users
    WHERE id = v_creator.creator_id;
    
    -- Check if wallet balance seems incorrect (less than completed earnings)
    -- This is a safe assumption since wallet should at least contain completed earnings
    IF v_current_wallet_balance < v_total_completed_earnings THEN
      -- Calculate what the wallet balance should be
      v_expected_wallet_balance := v_current_wallet_balance + (v_total_completed_earnings - v_current_wallet_balance);
      
      -- Update the wallet balance
      UPDATE users
      SET 
        wallet_balance = v_expected_wallet_balance,
        updated_at = NOW()
      WHERE id = v_creator.creator_id;
      
      -- Log this backfill operation
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        user_id,
        details
      ) VALUES (
        'wallet_balance_backfill',
        'users',
        v_creator.creator_id,
        v_creator.creator_id,
        jsonb_build_object(
          'old_balance', v_current_wallet_balance,
          'new_balance', v_expected_wallet_balance,
          'completed_earnings', v_total_completed_earnings,
          'backfill_date', NOW(),
          'reason', 'fix_missing_earnings_wallet_updates'
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION update_earnings_and_wallet_on_completion() IS 
'Trigger function that updates earnings status and creator wallet balance when a request is completed. This ensures the available withdrawal amount updates correctly in the dashboard.';
