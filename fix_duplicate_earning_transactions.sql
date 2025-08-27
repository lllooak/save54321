-- Fix duplicate earning transactions causing doubled withdrawal amounts
-- Based on diagnostic results showing multiple earning transactions per creator

-- Step 1: Backup current state before cleanup
CREATE TABLE IF NOT EXISTS wallet_transactions_backup AS 
SELECT * FROM wallet_transactions WHERE type IN ('earning', 'earnings');

-- Step 2: Identify and remove duplicate earning transactions
-- Keep only the most recent transaction for each unique (user_id, reference_id) combination
WITH duplicate_earnings AS (
  SELECT 
    id,
    user_id,
    reference_id,
    amount,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, reference_id 
      ORDER BY created_at DESC
    ) as rn
  FROM wallet_transactions 
  WHERE type IN ('earning', 'earnings')
  AND reference_id IS NOT NULL
),
transactions_to_delete AS (
  SELECT id 
  FROM duplicate_earnings 
  WHERE rn > 1  -- Keep only the most recent (rn = 1), delete others
)
DELETE FROM wallet_transactions 
WHERE id IN (SELECT id FROM transactions_to_delete);

-- Step 3: Update remaining earning transactions to use consistent 'earnings' type
UPDATE wallet_transactions 
SET type = 'earnings' 
WHERE type = 'earning';

-- Step 4: Recalculate and fix creator wallet balances
-- This ensures wallet_balance matches the actual earnings they should have
WITH creator_correct_earnings AS (
  SELECT 
    creator_id,
    SUM(amount) as total_should_have
  FROM earnings 
  WHERE status = 'completed'
  GROUP BY creator_id
),
creator_current_balance AS (
  SELECT 
    id as user_id,
    wallet_balance as current_balance
  FROM users 
  WHERE role = 'creator'
),
wallet_earning_totals AS (
  SELECT 
    user_id,
    COALESCE(SUM(amount), 0) as wallet_earnings_total
  FROM wallet_transactions 
  WHERE type = 'earnings'
  GROUP BY user_id
)
UPDATE users 
SET wallet_balance = (
  -- Start with current balance
  users.wallet_balance 
  -- Subtract all current earning transactions (to remove duplicates effect)
  - COALESCE(wet.wallet_earnings_total, 0)
  -- Add back only the correct earnings amount
  + COALESCE(cce.total_should_have, 0)
)
FROM creator_correct_earnings cce
FULL OUTER JOIN wallet_earning_totals wet ON wet.user_id = cce.creator_id
WHERE users.id = COALESCE(cce.creator_id, wet.user_id)
AND users.role = 'creator';

-- Step 5: Update the trigger function to prevent future duplicates
CREATE OR REPLACE FUNCTION update_earnings_on_completion_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
  v_transaction_id uuid;
  v_existing_transaction_count int;
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status <> 'completed') THEN
    -- Get request details
    SELECT creator_id INTO v_creator_id
    FROM requests
    WHERE id = NEW.id;
    
    -- Get earnings record
    SELECT * INTO v_earnings_record
    FROM earnings
    WHERE request_id = NEW.id
    FOR UPDATE;
    
    IF v_earnings_record IS NULL THEN
      RAISE EXCEPTION 'Earnings record not found for request %', NEW.id;
    END IF;
    
    IF v_earnings_record.status = 'completed' THEN
      -- Already processed, nothing to do
      RETURN NEW;
    END IF;
    
    -- CHECK: Prevent duplicate transactions - see if we already have a transaction for this request
    SELECT COUNT(*) INTO v_existing_transaction_count
    FROM wallet_transactions 
    WHERE user_id = v_creator_id 
    AND type = 'earnings'
    AND reference_id = NEW.id::text;
    
    IF v_existing_transaction_count > 0 THEN
      -- Transaction already exists, just update earnings status
      UPDATE earnings
      SET status = 'completed'
      WHERE id = v_earnings_record.id;
      
      RETURN NEW;
    END IF;
    
    -- Round the amount to 2 decimal places
    v_creator_amount := ROUND(v_earnings_record.amount::numeric, 2);
    
    -- Update earnings status to completed
    UPDATE earnings
    SET status = 'completed'
    WHERE id = v_earnings_record.id;
    
    -- Add creator's share to their wallet
    UPDATE users
    SET wallet_balance = ROUND((wallet_balance + v_creator_amount)::numeric, 2)
    WHERE id = v_creator_id;
    
    -- Create creator's earning transaction (using 'earnings' type consistently)
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_creator_id,
      'earnings',  -- Fixed: use 'earnings' not 'earning'
      v_creator_amount,
      'platform',
      'completed',
      'Video request earning (70% of payment)',
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Log the completion
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'request_completed_earnings',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'creator_amount', v_creator_amount,
        'transaction_id', v_transaction_id,
        'earnings_id', v_earnings_record.id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in update_earnings_on_completion_trigger_func: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 6: Verification queries
SELECT 'CLEANUP SUMMARY' as summary_type;

SELECT 
  'After cleanup - Wallet transaction totals' as analysis_type,
  user_id as creator_id,
  SUM(amount) as earning_transactions_total,
  COUNT(*) as earning_transaction_count
FROM wallet_transactions
WHERE type = 'earnings'
GROUP BY user_id
ORDER BY user_id;
