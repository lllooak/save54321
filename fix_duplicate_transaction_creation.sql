-- FIX: Prevent duplicate wallet transactions from being created
-- Problem: Multiple earnings transactions with same reference_id are being created

-- Step 1: Add unique constraint to prevent duplicate reference_id transactions
-- This will prevent the database from allowing duplicate earnings for same request

-- Create partial unique index instead of constraint with WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS unique_earnings_per_request 
ON wallet_transactions (reference_id, type, user_id)
WHERE type IN ('earnings', 'purchase', 'refund') AND reference_id IS NOT NULL;

-- Step 2: Update the RPC function to check for existing transactions
-- before creating new ones (prevent duplicates at source)

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

  -- Check if we already processed this request
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

  -- Create wallet transaction for creator earnings
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

-- Step 4: Clean up existing duplicates (run this after deploying the fix)
-- This will remove duplicate transactions but keep wallet balances correct

WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id, type, user_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM wallet_transactions
  WHERE type = 'earnings'
  AND reference_id IS NOT NULL
)
DELETE FROM wallet_transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Step 5: Recalculate wallet balances after cleanup
UPDATE users 
SET wallet_balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN wt.type IN ('earnings', 'top_up', 'refund') THEN wt.amount
      WHEN wt.type IN ('purchase', 'fee') THEN -ABS(wt.amount)
      ELSE 0
    END
  ), 0)
  FROM wallet_transactions wt
  WHERE wt.user_id = users.id
)
WHERE role = 'creator';

SELECT 'DUPLICATE PREVENTION DEPLOYED' as status;

-- DEPLOYMENT INSTRUCTIONS:
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Test completing a request - should work without doubling
-- 3. Check creator dashboard - "זמין למשיכה" should update correctly (no more 2x)
-- 4. The unique constraint will prevent future duplicates
-- 5. Existing duplicates are cleaned up
-- 6. Wallet balances are recalculated correctly
