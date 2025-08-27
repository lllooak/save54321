-- Fix for UUID/text type mismatch error in video upload
-- Cast all UUID references to text for reference_id field

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
  v_existing_earning_count integer;
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

  -- Check if we already processed this request (DUPLICATE PREVENTION)
  -- FIXED: Cast p_request_id to text for comparison
  SELECT COUNT(*)
  INTO v_existing_earning_count
  FROM wallet_transactions wt
  WHERE wt.reference_id = p_request_id::text  -- FIXED: Cast UUID to text
  AND wt.type = 'earnings'
  AND wt.user_id = v_creator_id;

  -- If earnings already exist, don't create duplicates
  IF v_existing_earning_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed',
      'reference_id', p_request_id::text  -- FIXED: Cast to text for JSON
    );
  END IF;

  -- Validate request exists and is in completable status
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or not in completable status (must be pending or approved)'
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

  -- Create earnings record
  INSERT INTO earnings (
    id,
    creator_id,
    fan_id,
    request_id,
    amount,
    platform_fee,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_creator_id,
    v_fan_id,
    p_request_id,
    v_creator_earnings,
    v_platform_fee,
    'completed',
    NOW()
  );

  -- Update creator's wallet balance
  UPDATE users 
  SET wallet_balance = wallet_balance + v_creator_earnings
  WHERE id = v_creator_id;

  -- Create wallet transaction for creator earnings (WITH DUPLICATE PREVENTION)
  -- FIXED: Cast p_request_id to text for reference_id
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
    'Earnings from completed request: ' || p_request_id::text,  -- FIXED: Cast to text
    p_request_id::text,  -- FIXED: Cast UUID to text
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  -- Create platform fee transaction (WITH DUPLICATE PREVENTION)  
  -- FIXED: Cast p_request_id to text for reference_id
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
    'Platform fee for request: ' || p_request_id::text,  -- FIXED: Cast to text
    p_request_id::text,  -- FIXED: Cast UUID to text
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Request completed successfully',
    'reference_id', p_request_id::text,  -- FIXED: Cast to text for JSON
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
      'reference_id', p_request_id::text  -- FIXED: Cast to text for JSON
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

-- Test the fix with the failing request
SELECT complete_request_and_pay_creator('d10fdb51-eb0e-4fc3-83c4-d2430cbafc49'::uuid) as result;
