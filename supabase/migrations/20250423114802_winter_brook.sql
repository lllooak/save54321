-- Drop existing triggers first to remove dependencies
DROP TRIGGER IF EXISTS request_status_change_trigger ON requests;
DROP TRIGGER IF EXISTS update_earnings_on_completion_trigger ON requests;

-- Now it's safe to drop the functions
DROP FUNCTION IF EXISTS process_request_refund();
DROP FUNCTION IF EXISTS update_earnings_on_completion_trigger_func();
DROP FUNCTION IF EXISTS process_request_payment();

-- Create updated function with proper earnings handling
CREATE OR REPLACE FUNCTION process_request_payment(
  p_request_id uuid,
  p_fan_id uuid,
  p_creator_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
  v_fan_balance numeric;
  v_admin_id uuid;
  v_earnings_id uuid;
BEGIN
  -- Round the input amount to 2 decimal places
  p_amount := ROUND(p_amount::numeric, 2);
  
  -- Calculate fee and creator amounts with proper rounding
  v_fee_amount := ROUND((p_amount * v_platform_fee / 100)::numeric, 2);
  v_creator_amount := ROUND((p_amount - v_fee_amount)::numeric, 2);

  -- Get fan's current balance
  SELECT wallet_balance INTO v_fan_balance
  FROM users
  WHERE id = p_fan_id
  FOR UPDATE;

  -- Check if fan has sufficient balance
  IF v_fan_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Get admin user id
  SELECT id INTO v_admin_id
  FROM users
  WHERE role = 'admin'
  LIMIT 1;

  -- Begin transaction
  BEGIN
    -- Deduct amount from fan's wallet
    UPDATE users
    SET wallet_balance = ROUND((wallet_balance - p_amount)::numeric, 2)
    WHERE id = p_fan_id;

    -- Create earnings record with pending status
    -- IMPORTANT: We don't add to creator's wallet balance yet - only when request is completed
    INSERT INTO earnings (
      creator_id,
      request_id,
      amount,
      status
    ) VALUES (
      p_creator_id,
      p_request_id,
      v_creator_amount,
      'pending'
    )
    RETURNING id INTO v_earnings_id;

    -- Create transaction records
    -- Fan's purchase transaction
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      p_fan_id,
      'purchase',
      p_amount,
      'wallet',
      'completed',
      'Video request payment'
    );

    -- Platform fee transaction
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        payment_method,
        payment_status,
        description
      ) VALUES (
        v_admin_id,
        'fee',
        v_fee_amount,
        'platform',
        'completed',
        'Platform fee (30% of payment)'
      );
      
      -- Add platform fee to admin's wallet
      UPDATE users
      SET wallet_balance = ROUND((wallet_balance + v_fee_amount)::numeric, 2)
      WHERE id = v_admin_id;
    END IF;

    -- Update request status
    UPDATE requests
    SET status = 'pending'
    WHERE id = p_request_id;

    -- Log the payment processing
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'process_payment',
      'requests',
      p_request_id,
      p_fan_id,
      jsonb_build_object(
        'total_amount', p_amount,
        'platform_fee_percentage', v_platform_fee,
        'platform_fee_amount', v_fee_amount,
        'creator_amount', v_creator_amount,
        'fan_id', p_fan_id,
        'creator_id', p_creator_id,
        'earnings_id', v_earnings_id,
        'earnings_status', 'pending'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'total_amount', p_amount,
      'platform_fee_percentage', v_platform_fee,
      'platform_fee_amount', v_fee_amount,
      'creator_amount', v_creator_amount,
      'earnings_id', v_earnings_id,
      'earnings_status', 'pending'
    );
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Error in process_request_payment: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$;

-- Create or replace the function to process refunds when a request is declined
CREATE OR REPLACE FUNCTION process_request_refund()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_fan_id uuid;
  v_creator_id uuid;
  v_amount numeric;
  v_transaction_id uuid;
  v_earnings_record RECORD;
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
    
    -- Get earnings record if it exists
    SELECT * INTO v_earnings_record
    FROM earnings
    WHERE request_id = NEW.id;
    
    -- Process the refund
    
    -- Refund full amount to fan
    UPDATE users
    SET 
      wallet_balance = wallet_balance + v_amount,
      updated_at = NOW()
    WHERE id = v_fan_id;
    
    -- Update earnings status to 'refunded' if it exists
    IF v_earnings_record.id IS NOT NULL THEN
      UPDATE earnings
      SET status = 'refunded'
      WHERE id = v_earnings_record.id;
    END IF;
    
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
    -- Log error without failing
    RAISE WARNING 'Error in process_request_refund: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to automatically process refunds
CREATE TRIGGER request_status_change_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_refund();

-- Create trigger function to update earnings when request is completed
CREATE OR REPLACE FUNCTION update_earnings_on_completion_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
  v_transaction_id uuid;
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status <> 'completed') THEN
    -- Get request details
    SELECT creator_id INTO v_creator_id
    FROM requests
    WHERE id = NEW.id;
    
    -- Get earnings record
    SELECT * INTO v_earnings_record
    FROM earnings
    WHERE request_id = NEW.id
    FOR UPDATE;
    
    IF v_earnings_record IS NULL THEN
      RAISE EXCEPTION 'Earnings record not found for request %', NEW.id;
    END IF;
    
    IF v_earnings_record.status = 'completed' THEN
      -- Already processed, nothing to do
      RETURN NEW;
    END IF;
    
    -- Round the amount to 2 decimal places
    v_creator_amount := ROUND(v_earnings_record.amount::numeric, 2);
    
    -- Update earnings status to completed
    UPDATE earnings
    SET status = 'completed'
    WHERE id = v_earnings_record.id;
    
    -- Add creator's share to their wallet - THIS IS THE KEY CHANGE
    -- Only add to wallet when request is completed
    UPDATE users
    SET wallet_balance = ROUND((wallet_balance + v_creator_amount)::numeric, 2)
    WHERE id = v_creator_id;
    
    -- Create creator's earning transaction
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
      'earning',
      v_creator_amount,
      'platform',
      'completed',
      'Video request earning (70% of payment)',
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Log the completion
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'request_completed_earnings',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'creator_id', v_creator_id,
        'amount', v_creator_amount,
        'transaction_id', v_transaction_id,
        'completed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in update_earnings_on_completion_trigger_func: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to automatically update earnings when request is completed
CREATE TRIGGER update_earnings_on_completion_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
WHEN ((NEW.status = 'completed') AND (OLD.status <> 'completed'))
EXECUTE FUNCTION update_earnings_on_completion_trigger_func();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_request_payment TO authenticated;
GRANT EXECUTE ON FUNCTION process_request_refund TO authenticated;
GRANT EXECUTE ON FUNCTION update_earnings_on_completion_trigger_func TO authenticated;
