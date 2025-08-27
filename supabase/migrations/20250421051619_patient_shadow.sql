/*
  # Add refund functionality for declined requests

  1. Changes
    - Create function to handle request status changes
    - Add trigger to automatically process refunds when a request is declined
    - Update existing functions to support refund processing
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper transaction handling for refunds
*/

-- Create function to process refunds when a request is declined
CREATE OR REPLACE FUNCTION process_request_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_fan_id uuid;
  v_creator_id uuid;
  v_amount numeric;
  v_creator_amount numeric;
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_admin_id uuid;
  v_creator_balance numeric;
BEGIN
  -- Only process when status changes from pending/approved to declined
  IF (NEW.status = 'declined' AND (OLD.status = 'pending' OR OLD.status = 'approved')) THEN
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
    
    -- Get creator's current balance
    SELECT wallet_balance INTO v_creator_balance
    FROM users
    WHERE id = v_creator_id
    FOR UPDATE;
    
    -- Check if creator has sufficient balance to refund
    -- This is only relevant if the creator already received payment
    IF v_creator_balance < v_creator_amount THEN
      RAISE EXCEPTION 'Creator has insufficient balance for refund';
    END IF;
    
    -- Process the refund
    
    -- Refund amount to fan
    UPDATE users
    SET wallet_balance = wallet_balance + v_amount
    WHERE id = v_fan_id;
    
    -- Deduct creator's share from their wallet if they received payment
    UPDATE users
    SET wallet_balance = wallet_balance - v_creator_amount
    WHERE id = v_creator_id;
    
    -- Deduct platform fee from admin's wallet if admin exists
    IF v_admin_id IS NOT NULL THEN
      UPDATE users
      SET wallet_balance = wallet_balance - v_fee_amount
      WHERE id = v_admin_id;
    END IF;
    
    -- Create refund transaction record for fan
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_fan_id,
      'refund',
      v_amount,
      'wallet',
      'completed',
      'Refund for declined video request',
      NEW.id::text
    );
    
    -- Create transaction record for creator's deduction
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
      'refund',
      -v_creator_amount,
      'platform',
      'completed',
      'Deduction for declined video request',
      NEW.id::text
    );
    
    -- Create transaction record for admin's fee deduction
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        payment_method,
        payment_status,
        description,
        reference_id
      ) VALUES (
        v_admin_id,
        'refund',
        -v_fee_amount,
        'platform',
        'completed',
        'Platform fee refund for declined request',
        NEW.id::text
      );
    END IF;
    
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
        'creator_amount', v_creator_amount,
        'platform_fee', v_fee_amount,
        'fan_id', v_fan_id,
        'creator_id', v_creator_id,
        'reason', 'Request declined by creator'
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

-- Create trigger to automatically process refunds
DROP TRIGGER IF EXISTS request_status_change_trigger ON requests;
CREATE TRIGGER request_status_change_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_refund();

-- Add reference_id column to wallet_transactions if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions' 
    AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE wallet_transactions 
    ADD COLUMN reference_id text;
  END IF;
END $$;
