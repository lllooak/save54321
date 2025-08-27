-- Fix parameter name mismatch - app calls with p_request_id, not request_id

-- Drop our current function
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(request_id uuid, video_url text);

-- Create function with the EXACT parameter name the app expects
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
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
  WHERE id = p_request_id 
  AND status = 'pending';

  -- Check if we already processed this request (DUPLICATE PREVENTION)
  SELECT COUNT(*)
  INTO existing_earning_count
  FROM wallet_transactions
  WHERE reference_id = p_request_id
  AND type = 'earnings'
  AND user_id = creator_id;

  -- If earnings already exist, don't create duplicates
  IF existing_earning_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed',
      'reference_id', p_request_id
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

  -- Update request status (no video_url since it's not passed)
  UPDATE requests 
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_request_id;

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
    p_request_id,
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
    fan_id,
    'fee',
    -platform_fee,
    'Platform fee (30% of payment)',
    p_request_id,
    NOW()
  ) ON CONFLICT (reference_id, type, user_id) DO NOTHING;

  result := json_build_object(
    'success', true,
    'request_id', p_request_id,
    'creator_earnings', creator_earnings,
    'platform_fee', platform_fee
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

-- Verify the function exists with correct signature
SELECT 
  'FUNCTION FIXED' as status,
  routine_name,
  CASE 
    WHEN routine_definition ILIKE '%p_request_id%' THEN 'CORRECT_PARAMETER_NAME'
    ELSE 'WRONG_PARAMETER_NAME'
  END as parameter_check
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator';

SELECT 'APP COMPATIBLE FUNCTION DEPLOYED' as final_status;
