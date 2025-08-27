-- CORRECT BUSINESS LOGIC: Update existing pending earnings to completed
-- Don't create new earnings - they should already exist from purchase
-- Only update wallet balance when earnings become completed

DROP FUNCTION IF EXISTS complete_request_and_pay_creator(p_request_id uuid);

CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_fan_id uuid;
  v_request_price numeric;
  v_platform_fee numeric;
  v_creator_earnings numeric;
  v_current_status text;
  v_existing_earnings_id uuid;
  v_existing_earnings_status text;
  v_earnings_transaction_exists boolean;
  v_result json;
BEGIN
  -- Get request details - ACCEPT BOTH 'pending' AND 'approved' statuses
  SELECT 
    r.creator_id, 
    r.fan_id, 
    r.price,
    r.status
  INTO v_creator_id, v_fan_id, v_request_price, v_current_status
  FROM requests r
  WHERE r.id = p_request_id 
  AND r.status IN ('pending', 'approved');

  -- Validate request exists and is in completable status
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or not in completable status (must be pending or approved)'
    );
  END IF;

  -- SMARTER CHECK: Only prevent if request is already COMPLETED
  IF v_current_status = 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already completed and processed'
    );
  END IF;

  -- Calculate amounts based on PRICE
  v_platform_fee := v_request_price * 0.30;
  v_creator_earnings := v_request_price - v_platform_fee;

  -- CORRECT LOGIC: Find existing pending earnings (should exist from purchase)
  SELECT id, status
  INTO v_existing_earnings_id, v_existing_earnings_status
  FROM earnings 
  WHERE request_id = p_request_id
  LIMIT 1;

  -- If no earnings exist, something is wrong with the purchase flow
  IF v_existing_earnings_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No earnings found for this request. Purchase may not have been processed correctly.'
    );
  END IF;

  -- If earnings are already completed, don't process again
  IF v_existing_earnings_status = 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Earnings already completed for this request'
    );
  END IF;

  -- Update request status to completed
  UPDATE requests 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;

  -- CORRECT LOGIC: Update existing pending earnings to completed
  UPDATE earnings
  SET 
    status = 'completed',
    amount = v_creator_earnings  -- Ensure amount is correct
  WHERE id = v_existing_earnings_id;

  -- Check if earnings transaction already exists
  SELECT EXISTS(
    SELECT 1 FROM wallet_transactions 
    WHERE reference_id = p_request_id::text 
    AND type = 'earning'
    AND user_id = v_creator_id
  ) INTO v_earnings_transaction_exists;

  -- ONLY NOW update wallet balance (when earnings become available for withdrawal)
  IF NOT v_earnings_transaction_exists THEN
    -- Update creator's wallet balance (זמין למשיכה)
    UPDATE users 
    SET wallet_balance = wallet_balance + v_creator_earnings
    WHERE id = v_creator_id;

    -- Create wallet transaction for completed earnings
    INSERT INTO wallet_transactions (
      id,
      user_id,
      type,
      amount,
      description,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_creator_id,
      'earning',
      v_creator_earnings,
      'Completed earnings from request: ' || p_request_id::text,
      p_request_id::text,
      NOW()
    );

    -- Create platform fee transaction
    INSERT INTO wallet_transactions (
      id,
      user_id,
      type,
      amount,
      description,
      reference_id,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_creator_id,
      'fee',
      -v_platform_fee,
      'Platform fee for request: ' || p_request_id::text,
      p_request_id::text,
      NOW()
    );
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Earnings completed successfully - now available for withdrawal',
    'reference_id', p_request_id::text,
    'creator_earnings', v_creator_earnings,
    'platform_fee', v_platform_fee,
    'previous_status', v_current_status,
    'earnings_status_changed', v_existing_earnings_status || ' -> completed'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details for debugging
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM,
      'reference_id', p_request_id::text
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

-- Test the fix with the failing request
SELECT complete_request_and_pay_creator('d10fdb51-eb0e-4fc3-83c4-d2430cbafc49'::uuid) as result;
