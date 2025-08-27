-- Fix multiple triggers causing wallet_transaction duplication
-- Drop ALL triggers first, then the function, then create clean solution

-- Drop all triggers that depend on the function (as shown in error)
DROP TRIGGER IF EXISTS update_earnings_and_wallet_on_completion_trigger ON requests;
DROP TRIGGER IF EXISTS earnings_wallet_update_trigger ON requests;
DROP TRIGGER IF EXISTS earnings_completion_trigger ON requests;

-- Now drop the function (no dependencies left)
DROP FUNCTION IF EXISTS update_earnings_and_wallet_on_completion();

-- Create a clean, simple trigger that only creates earnings (no wallet_transactions)
CREATE OR REPLACE FUNCTION create_earnings_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_earnings numeric;
  v_platform_fee numeric;
BEGIN
  -- Only process if status changed to 'completed' and creator_id exists
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.creator_id IS NOT NULL THEN
    
    -- Calculate amounts (30% platform fee)
    v_platform_fee := NEW.price * 0.30;
    v_creator_earnings := NEW.price - v_platform_fee;
    
    -- Create earnings record only (NO wallet_transactions)
    INSERT INTO earnings (
      id,
      creator_id,
      request_id,
      amount,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.creator_id,
      NEW.id,
      v_creator_earnings,
      'completed',
      NOW()
    ) ON CONFLICT (request_id) DO NOTHING; -- Prevent duplicates
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create single clean trigger (only for earnings)
CREATE TRIGGER clean_earnings_trigger
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION create_earnings_only();

-- Update RPC function to handle wallet_transactions exclusively
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
  v_existing_transactions integer;
  v_result json;
BEGIN
  -- Get request details
  SELECT 
    r.creator_id,
    r.fan_id,
    r.price
  INTO v_creator_id, v_fan_id, v_request_price
  FROM requests r
  WHERE r.id = p_request_id
  AND r.status = 'pending';

  -- Validate request exists and is pending
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or already completed'
    );
  END IF;

  -- Check if wallet_transactions already exist (DUPLICATE PREVENTION)
  SELECT COUNT(*)
  INTO v_existing_transactions
  FROM wallet_transactions wt
  WHERE wt.reference_id = p_request_id::text
  AND wt.type = 'earnings'
  AND wt.user_id = v_creator_id;

  -- If wallet_transactions already exist, don't create duplicates
  IF v_existing_transactions > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request already processed - wallet transactions exist',
      'reference_id', p_request_id::text
    );
  END IF;

  -- Calculate amounts
  v_platform_fee := v_request_price * 0.30;
  v_creator_earnings := v_request_price - v_platform_fee;

  -- Update request status (this will trigger earnings creation ONLY)
  UPDATE requests 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Update creator's wallet balance
  UPDATE users 
  SET wallet_balance = wallet_balance + v_creator_earnings
  WHERE id = v_creator_id;

  -- Create wallet transaction for creator earnings (FUNCTION HANDLES THIS)
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
    v_fan_id,
    'fee',
    -v_platform_fee,
    'Platform fee (30% of payment)',
    p_request_id::text,
    NOW()
  );

  v_result := json_build_object(
    'success', true,
    'request_id', p_request_id::text,
    'creator_earnings', v_creator_earnings,
    'platform_fee', v_platform_fee,
    'original_price', v_request_price
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;

SELECT 'ALL DUPLICATE TRIGGERS REMOVED - CLEAN SEPARATION DEPLOYED' as status;
