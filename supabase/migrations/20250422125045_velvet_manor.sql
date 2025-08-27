/*
  # Fix creator earnings and payment processing

  1. Changes
    - Update process_request_payment function to properly handle creator earnings
    - Add status tracking for earnings
    - Add trigger to update earnings status when request is completed
    - Fix platform fee calculation (30%)
  
  2. Security
    - Maintain existing security measures
    - Ensure proper transaction handling
*/

-- Create function to process request completion and update earnings
CREATE OR REPLACE FUNCTION update_earnings_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    -- Update earnings status to completed
    UPDATE earnings
    SET status = 'completed'
    WHERE request_id = NEW.id;
    
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
      (SELECT id FROM earnings WHERE request_id = NEW.id),
      NEW.creator_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'creator_id', NEW.creator_id,
        'completed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update earnings when request is completed
DROP TRIGGER IF EXISTS update_earnings_on_completion_trigger ON requests;
CREATE TRIGGER update_earnings_on_completion_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION update_earnings_on_completion();

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_request_payment;

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
  -- Calculate fee and creator amounts
  v_fee_amount := (p_amount * v_platform_fee / 100)::numeric(10,2);
  v_creator_amount := (p_amount - v_fee_amount)::numeric(10,2);

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
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_fan_id;

    -- Create earnings record with pending status
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
      SET wallet_balance = wallet_balance + v_fee_amount
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

-- Create function to complete request and update creator balance
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
  v_transaction_id uuid;
BEGIN
  -- Get request details
  SELECT creator_id INTO v_creator_id
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;
  
  -- Check if request is already completed
  IF EXISTS (
    SELECT 1 FROM requests 
    WHERE id = p_request_id 
    AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request already completed'
    );
  END IF;
  
  -- Get earnings record
  SELECT * INTO v_earnings_record
  FROM earnings
  WHERE request_id = p_request_id
  FOR UPDATE;
  
  IF v_earnings_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Earnings record not found'
    );
  END IF;
  
  IF v_earnings_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Earnings already processed'
    );
  END IF;
  
  v_creator_amount := v_earnings_record.amount;
  
  -- Update request status
  UPDATE requests
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Update earnings status
  UPDATE earnings
  SET 
    status = 'completed'
  WHERE id = v_earnings_record.id;
  
  -- Add creator's share to their wallet
  UPDATE users
  SET wallet_balance = wallet_balance + v_creator_amount
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
    p_request_id::text
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
    'request_completed',
    'requests',
    p_request_id,
    v_creator_id,
    jsonb_build_object(
      'creator_id', v_creator_id,
      'amount', v_creator_amount,
      'transaction_id', v_transaction_id,
      'completed_at', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'creator_id', v_creator_id,
    'amount', v_creator_amount,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_request_payment TO authenticated;
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;
GRANT EXECUTE ON FUNCTION update_earnings_on_completion TO authenticated;
