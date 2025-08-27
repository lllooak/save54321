/*
  # Add complete_request_and_pay_creator function

  1. Changes
    - Create function to complete a request and pay the creator
    - Update request status to completed
    - Update earnings status to completed
    - Add creator's earnings to their wallet balance
    - Create transaction record for the earnings
    - Log the completion in audit_logs
  
  2. Security
    - Function is SECURITY DEFINER to bypass RLS
    - Only updates the creator's balance when the request is completed
    - Prevents double payments by checking current status
*/

-- Create function to complete request and pay creator
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
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;
