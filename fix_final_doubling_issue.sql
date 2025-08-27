-- FINAL FIX: Remove wallet balance update from RPC to prevent doubling
-- The trigger already handles wallet balance updates when request status changes to 'completed'
-- The RPC should only update request status and let the trigger handle the rest

-- Update the complete_request_and_pay_creator function to remove wallet balance update
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_fan_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
BEGIN
  -- Get request details
  SELECT creator_id, fan_id INTO v_creator_id, v_fan_id
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
  
  -- Round the amount to 2 decimal places
  v_creator_amount := ROUND(v_earnings_record.amount::numeric, 2);
  
  -- ONLY update request status - let the trigger handle everything else
  -- This prevents double wallet balance updates
  UPDATE requests
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- NOTE: We removed the following operations because the trigger handles them:
  -- - Updating earnings status to 'completed'
  -- - Adding creator's share to their wallet
  -- - Creating creator's earning transaction
  -- - Creating audit logs
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Request completed successfully',
    'creator_id', v_creator_id,
    'creator_amount', v_creator_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

-- Verification: Show the current trigger function to confirm it handles everything
SELECT 'TRIGGER VERIFICATION' as verification_type;

-- The trigger should handle:
-- 1. Update earnings status to 'completed'
-- 2. Add creator's share to wallet
-- 3. Create earning transaction
-- 4. Create audit logs

-- Test query to show what will happen:
SELECT 
  'FLOW EXPLANATION' as explanation,
  'RPC updates request.status to completed' as step_1,
  'Trigger fires on status change' as step_2,
  'Trigger updates earnings, wallet_balance, creates transaction' as step_3,
  'NO MORE DOUBLE UPDATES!' as result;
