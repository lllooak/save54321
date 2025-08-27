-- Fix duplicate earning transactions causing double wallet crediting
-- Problem: complete_request_and_pay_creator function and update_earnings_on_completion_trigger_func 
-- both create identical "earning" wallet transactions for the same request

-- First, let's see how many duplicate earning transactions exist
SELECT 
    wt.reference_id as request_id,
    COUNT(*) as duplicate_count,
    SUM(wt.amount) as total_duplicated_amount,
    array_agg(wt.id) as transaction_ids,
    MIN(wt.created_at) as first_created,
    MAX(wt.created_at) as last_created
FROM wallet_transactions wt
JOIN users u ON wt.user_id = u.id
WHERE u.role = 'creator' 
AND wt.type = 'earning'
AND wt.reference_id IS NOT NULL
GROUP BY wt.reference_id
HAVING COUNT(*) > 1  -- Only duplicates
ORDER BY last_created DESC;

-- Solution: Remove the duplicate earning transaction creation from complete_request_and_pay_creator function
-- The trigger function should be the single source of truth for creating earning transactions

-- Update the complete_request_and_pay_creator function to remove duplicate transaction creation
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
  v_transaction_id uuid;
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
    WHERE id = p_request_id AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request is already completed'
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
      'error', 'Earnings already completed'
    );
  END IF;
  
  -- Round the amount to 2 decimal places
  v_creator_amount := ROUND(v_earnings_record.amount::numeric, 2);
  
  -- Update earnings status to completed first
  UPDATE earnings
  SET status = 'completed'
  WHERE id = v_earnings_record.id;
  
  -- Update request status to completed
  -- This will trigger update_earnings_on_completion_trigger_func which will:
  -- 1. Add money to creator's wallet
  -- 2. Create the earning wallet transaction
  UPDATE requests
  SET status = 'completed'
  WHERE id = p_request_id;
  
  -- REMOVED: The duplicate earning transaction creation that was causing double-counting
  -- The trigger function update_earnings_on_completion_trigger_func will handle this
  
  -- Log the completion
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'complete_request_manual',
    'requests',
    p_request_id,
    v_creator_id,
    jsonb_build_object(
      'creator_id', v_creator_id,
      'fan_id', v_fan_id,
      'creator_amount', v_creator_amount,
      'earnings_id', v_earnings_record.id,
      'method', 'manual_completion'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'creator_id', v_creator_id,
    'creator_amount', v_creator_amount,
    'earnings_id', v_earnings_record.id,
    'note', 'Earnings and wallet update handled by trigger function'
  );
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction failed: ' || SQLERRM
    );
END;
$$;

-- Summary message
DO $$
BEGIN
    RAISE NOTICE '=== FIX COMPLETE ===';
    RAISE NOTICE 'Removed duplicate earning transaction creation from complete_request_and_pay_creator function';
    RAISE NOTICE 'Now only update_earnings_on_completion_trigger_func creates earning transactions';
    RAISE NOTICE 'This should fix the double wallet crediting issue';
    RAISE NOTICE 'Test with a new request to verify the fix works';
END $$;
