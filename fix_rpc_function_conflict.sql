-- Fix function name conflict by dropping all versions and creating clean one

-- Step 1: Drop all versions of the function (with different signatures)
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(uuid);
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(uuid, text);
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(request_id uuid);
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(request_id uuid, video_url text);

-- Step 2: Create the clean, duplicate-prevention version
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  request_id uuid,
  video_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_id uuid;
  fan_id uuid;
  request_amount numeric;
  platform_fee numeric;
  creator_earnings numeric;
  existing_earning_count integer;
  result json;
BEGIN
  -- Get request details
  SELECT 
    creator_user_id, 
    fan_user_id, 
    amount
  INTO creator_id, fan_id, request_amount
  FROM requests 
  WHERE id = request_id 
  AND status = 'pending';

  -- Check if we already processed this request (DUPLICATE PREVENTION)
  SELECT COUNT(*)
  INTO existing_earning_count
  FROM wallet_transactions
  WHERE reference_id = request_id
  AND type = 'earnings'
  AND user_id = creator_id;

  -- If earnings already exist, don't create duplicates
  IF existing_earning_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed',
      'reference_id', request_id
    );
  END IF;

  -- Validate request exists and is pending
  IF creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or already completed'
    );
  END IF;

  -- Calculate amounts
  platform_fee := request_amount * 0.30;
  creator_earnings := request_amount - platform_fee;

  -- Update request status and video URL
  UPDATE requests 
  SET 
    status = 'completed',
    video_url = COALESCE(video_url, requests.video_url),
    completed_at = NOW()
  WHERE id = request_id;

  -- Create earnings record
  INSERT INTO earnings (
    id,
    creator_user_id,
    fan_user_id,
    request_id,
    amount,
    platform_fee,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    creator_id,
    fan_id,
    request_id,
    creator_earnings,
    platform_fee,
    'completed',
    NOW()
  );

  -- Update creator's wallet balance
  UPDATE users 
  SET wallet_balance = wallet_balance + creator_earnings
  WHERE id = creator_id;

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
    creator_id,
    'earnings',
    creator_earnings,
    'Earnings from completed request: ' || request_id,
    request_id,
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
    fan_id,
    'fee',
    -platform_fee,
    'Platform fee (30% of payment)',
    request_id,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  result := json_build_object(
    'success', true,
    'request_id', request_id,
    'creator_earnings', creator_earnings,
    'platform_fee', platform_fee
  );

  RETURN result;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

-- Step 4: Verify function was created successfully
SELECT 
  'FUNCTION DEPLOYED' as status,
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator';

SELECT 'RPC FUNCTION FIXED - READY FOR TESTING' as final_status;
