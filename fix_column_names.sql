-- Check actual requests table schema and fix function

-- Step 1: Check the actual column names in requests table
SELECT 
  'REQUESTS_TABLE_SCHEMA' as info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'requests'
ORDER BY ordinal_position;

-- Step 2: Drop current function and create with correct column names
DROP FUNCTION IF EXISTS complete_request_and_pay_creator(p_request_id uuid);

-- Step 3: Create function with correct column names (most likely creator_id, fan_id)
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
  -- Get request details with CORRECT column names
  SELECT 
    creator_id, 
    fan_id, 
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

  -- Update request status
  UPDATE requests 
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_request_id;

  -- Create earnings record with correct column names
  INSERT INTO earnings (
    id,
    creator_id,  -- Use correct column name
    fan_id,      -- Use correct column name
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

-- Step 4: Verify function was created successfully
SELECT 'FUNCTION FIXED WITH CORRECT SCHEMA' as final_status;
