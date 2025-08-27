-- SMARTER DUPLICATE PREVENTION: Allow video uploads, prevent duplicate payments
-- The issue: function was blocking ALL attempts if ANY records exist
-- Fix: Only prevent if request is already COMPLETED status
-- Allow video upload for approved requests even if partial records exist

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
  AND r.status IN ('pending', 'approved');  -- Accept both statuses

  -- Validate request exists and is in completable status
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or not in completable status (must be pending or approved)'
    );
  END IF;

  -- SMARTER CHECK: Only prevent if request is already COMPLETED
  -- Don't block based on existing earnings/transactions - check request status instead
  IF v_current_status = 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already completed and processed'
    );
  END IF;

  -- Calculate amounts based on PRICE
  v_platform_fee := v_request_price * 0.30;
  v_creator_earnings := v_request_price - v_platform_fee;

  -- Update request status to completed
  UPDATE requests 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Create earnings record with duplicate prevention (in case of race conditions)
  -- earnings table only has: creator_id, request_id, amount, status
  INSERT INTO earnings (
    creator_id,
    request_id,
    amount,
    status
  ) VALUES (
    v_creator_id,
    p_request_id,
    v_creator_earnings,
    'completed'
  ) ON CONFLICT (request_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status;  -- Update if exists

  -- Update creator's wallet balance (safe to run multiple times)
  UPDATE users 
  SET wallet_balance = wallet_balance + v_creator_earnings
  WHERE id = v_creator_id
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions 
    WHERE reference_id = p_request_id::text 
    AND type = 'earnings' 
    AND user_id = v_creator_id
  );

  -- Create wallet transaction for creator earnings (WITH DUPLICATE PREVENTION)
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
    'earnings',
    v_creator_earnings,
    'Earnings from completed request: ' || p_request_id::text,
    p_request_id::text,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  -- Create platform fee transaction (WITH DUPLICATE PREVENTION)  
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
    'platform_fee',
    -v_platform_fee,
    'Platform fee for request: ' || p_request_id::text,
    p_request_id::text,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Request completed successfully',
    'reference_id', p_request_id::text,
    'creator_earnings', v_creator_earnings,
    'platform_fee', v_platform_fee,
    'previous_status', v_current_status
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
