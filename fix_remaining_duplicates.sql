-- Fix remaining duplicate earning transactions
-- Target transactions with NULL reference_id or other edge cases

-- Step 1: Analyze remaining duplicates in detail
SELECT 
  'REMAINING DUPLICATES ANALYSIS' as analysis_type,
  user_id,
  reference_id,
  amount,
  created_at,
  payment_status,
  description,
  COUNT(*) OVER (PARTITION BY user_id, amount, DATE(created_at)) as same_day_same_amount_count
FROM wallet_transactions 
WHERE type = 'earnings'
AND user_id IN (
  -- Focus on users who still have multiple transactions
  SELECT user_id 
  FROM wallet_transactions 
  WHERE type = 'earnings'
  GROUP BY user_id 
  HAVING COUNT(*) > 1
)
ORDER BY user_id, created_at DESC;

-- Step 2: Clean up transactions with NULL reference_id
-- Keep only the most recent transaction per user per day with same amount
WITH null_ref_duplicates AS (
  SELECT 
    id,
    user_id,
    amount,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, amount, DATE(created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM wallet_transactions 
  WHERE type = 'earnings'
  AND reference_id IS NULL
),
null_ref_to_delete AS (
  SELECT id 
  FROM null_ref_duplicates 
  WHERE rn > 1  -- Keep only the most recent per day per amount
)
DELETE FROM wallet_transactions 
WHERE id IN (SELECT id FROM null_ref_to_delete);

-- Step 3: Handle same-amount transactions on same day (likely duplicates)
WITH same_amount_duplicates AS (
  SELECT 
    id,
    user_id,
    amount,
    created_at,
    reference_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, amount, DATE(created_at)
      ORDER BY 
        CASE WHEN reference_id IS NOT NULL THEN 1 ELSE 2 END, -- Prefer transactions with reference_id
        created_at DESC
    ) as rn
  FROM wallet_transactions 
  WHERE type = 'earnings'
  AND user_id IN (
    SELECT user_id 
    FROM wallet_transactions 
    WHERE type = 'earnings'
    GROUP BY user_id, amount, DATE(created_at)
    HAVING COUNT(*) > 1
  )
),
same_amount_to_delete AS (
  SELECT id 
  FROM same_amount_duplicates 
  WHERE rn > 1
)
DELETE FROM wallet_transactions 
WHERE id IN (SELECT id FROM same_amount_to_delete);

-- Step 4: For creators with still too many transactions, keep only reasonable amount
-- This is a more aggressive cleanup for cases like creator d6aafc3 with 14 transactions
WITH excessive_transactions AS (
  SELECT 
    id,
    user_id,
    amount,
    created_at,
    reference_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY 
        CASE WHEN reference_id IS NOT NULL THEN 1 ELSE 2 END, -- Prefer transactions with reference_id
        created_at DESC
    ) as rn
  FROM wallet_transactions 
  WHERE type = 'earnings'
  AND user_id IN (
    -- Target users with more than 5 earning transactions (clearly excessive)
    SELECT user_id 
    FROM wallet_transactions 
    WHERE type = 'earnings'
    GROUP BY user_id 
    HAVING COUNT(*) > 5
  )
),
excessive_to_delete AS (
  SELECT id 
  FROM excessive_transactions 
  WHERE rn > 5  -- Keep max 5 transactions per creator
)
DELETE FROM wallet_transactions 
WHERE id IN (SELECT id FROM excessive_to_delete);

-- Step 5: Recalculate wallet balances again after additional cleanup
WITH creator_should_have AS (
  SELECT 
    creator_id,
    SUM(amount) as total_earnings
  FROM earnings 
  WHERE status = 'completed'
  GROUP BY creator_id
),
creator_wallet_totals AS (
  SELECT 
    user_id,
    SUM(amount) as wallet_earnings_total
  FROM wallet_transactions 
  WHERE type = 'earnings'
  GROUP BY user_id
)
UPDATE users 
SET wallet_balance = (
  -- Start fresh: subtract all current earning transactions
  users.wallet_balance - COALESCE(cwt.wallet_earnings_total, 0)
  -- Add back correct earnings from earnings table
  + COALESCE(csh.total_earnings, 0)
)
FROM creator_should_have csh
FULL OUTER JOIN creator_wallet_totals cwt ON cwt.user_id = csh.creator_id
WHERE users.id = COALESCE(csh.creator_id, cwt.user_id)
AND users.role = 'creator';

-- Step 6: Final verification
SELECT 
  'FINAL CLEANUP RESULTS' as summary_type,
  user_id as creator_id,
  SUM(amount) as total_earnings,
  COUNT(*) as transaction_count,
  STRING_AGG(
    CASE 
      WHEN reference_id IS NOT NULL THEN 'REF'
      ELSE 'NULL'
    END, 
    ','
  ) as reference_status
FROM wallet_transactions
WHERE type = 'earnings'
GROUP BY user_id
ORDER BY transaction_count DESC, user_id;
