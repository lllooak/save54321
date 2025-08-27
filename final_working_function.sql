-- FINAL WORKING FUNCTION - Using correct schema (price, not amount)

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
  v_request_price numeric;  -- Using PRICE, not amount!
  v_platform_fee numeric;
  v_creator_earnings numeric;
  v_existing_earning_count integer;
  v_result json;
BEGIN
  -- Get request details with CORRECT column names
  SELECT 
    r.creator_id, 
    r.fan_id, 
    r.price        -- CORRECT: using "price" column
  INTO v_creator_id, v_fan_id, v_request_price
  FROM requests r
  WHERE r.id = p_request_id 
  AND r.status = 'pending';

  -- Check if we already processed this request (DUPLICATE PREVENTION)
  SELECT COUNT(*)
  INTO v_existing_earning_count
  FROM wallet_transactions wt
  WHERE wt.reference_id = p_request_id
  AND wt.type = 'earnings'
  AND wt.user_id = v_creator_id;

  -- If earnings already exist, don't create duplicates
  IF v_existing_earning_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed',
      'reference_id', p_request_id
    );
  END IF;

  -- Validate request exists and is pending
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or already completed'
    );
  END IF;

  -- Calculate amounts based on PRICE
  v_platform_fee := v_request_price * 0.30;
  v_creator_earnings := v_request_price - v_platform_fee;

  -- Update request status
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
    'Earnings from completed request: ' || p_request_id,
    p_request_id,
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
    v_fan_id,
    'fee',
    -v_platform_fee,
    'Platform fee (30% of payment)',
    p_request_id,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  v_result := json_build_object(
    'success', true,
    'request_id', p_request_id,
    'creator_earnings', v_creator_earnings,
    'platform_fee', v_platform_fee,
    'original_price', v_request_price
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

SELECT 'FINAL FUNCTION DEPLOYED - SCHEMA CORRECT - READY FOR TESTING' as final_status;
