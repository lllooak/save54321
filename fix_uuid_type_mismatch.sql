-- Fix UUID/text type mismatch error

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
  v_result json;
BEGIN
  -- Get request details - ensure proper UUID casting
  SELECT 
    r.creator_id::uuid,   -- Explicit UUID casting
    r.fan_id::uuid,       -- Explicit UUID casting
    r.price::numeric      -- Explicit numeric casting
  INTO v_creator_id, v_fan_id, v_request_price
  FROM requests r
  WHERE r.id = p_request_id::uuid  -- Ensure parameter is treated as UUID
  AND r.status = 'pending';

  -- Check if we already processed this request (DUPLICATE PREVENTION)
  SELECT COUNT(*)::integer
  INTO v_existing_earning_count
  FROM wallet_transactions wt
  WHERE wt.reference_id = p_request_id::uuid  -- Explicit UUID casting
  AND wt.type = 'earnings'
  AND wt.user_id = v_creator_id::uuid;

  -- If earnings already exist, don't create duplicates
  IF v_existing_earning_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed',
      'reference_id', p_request_id::text  -- Cast UUID to text for JSON
    );
  END IF;

  -- Validate request exists and is pending
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or already completed'
    );
  END IF;

  -- Calculate amounts
  v_platform_fee := v_request_price * 0.30;
  v_creator_earnings := v_request_price - v_platform_fee;

  -- Update request status
  UPDATE requests 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id::uuid;

  -- Create earnings record with explicit type casting
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
    v_creator_id::uuid,
    v_fan_id::uuid,
    p_request_id::uuid,
    v_creator_earnings::numeric,
    v_platform_fee::numeric,
    'completed',
    NOW()
  );

  -- Update creator's wallet balance
  UPDATE users 
  SET wallet_balance = wallet_balance + v_creator_earnings::numeric
  WHERE id = v_creator_id::uuid;

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
    v_creator_id::uuid,
    'earnings',
    v_creator_earnings::numeric,
    'Earnings from completed request: ' || p_request_id::text,  -- Cast UUID to text for concatenation
    p_request_id::uuid,
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
    v_fan_id::uuid,
    'fee',
    (-v_platform_fee)::numeric,  -- Ensure negative numeric
    'Platform fee (30% of payment)',
    p_request_id::uuid,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  v_result := json_build_object(
    'success', true,
    'request_id', p_request_id::text,           -- Cast to text for JSON
    'creator_earnings', v_creator_earnings::numeric,
    'platform_fee', v_platform_fee::numeric,
    'original_price', v_request_price::numeric
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

SELECT 'UUID TYPE CASTING FIXED - READY FOR TESTING' as final_status;
