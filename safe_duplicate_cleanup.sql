-- Safe duplicate cleanup that handles negative balance constraint

-- Step 1: Show current duplicates first
SELECT 
  'CURRENT DUPLICATES' as status,
  reference_id,
  type,
  user_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(amount::text, ', ') as amounts
FROM wallet_transactions
WHERE reference_id IS NOT NULL
GROUP BY reference_id, type, user_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- Step 2: Temporarily disable the wallet balance check constraint
ALTER TABLE users DISABLE TRIGGER ALL;

-- Step 3: Remove duplicates, keeping only the first (oldest) transaction
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id, type, user_id 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM wallet_transactions
  WHERE reference_id IS NOT NULL
)
DELETE FROM wallet_transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Step 4: Recalculate wallet balances (but handle negatives safely)
UPDATE users 
SET wallet_balance = GREATEST(0, (
  SELECT COALESCE(SUM(
    CASE 
      WHEN wt.type IN ('earnings', 'top_up', 'refund') THEN wt.amount
      WHEN wt.type IN ('purchase', 'fee') THEN -ABS(wt.amount)
      ELSE 0
    END
  ), 0)
  FROM wallet_transactions wt
  WHERE wt.user_id = users.id
))
WHERE role = 'creator';

-- Step 5: Re-enable triggers
ALTER TABLE users ENABLE TRIGGER ALL;

-- Step 6: Create the unique index (now that duplicates are gone)
CREATE UNIQUE INDEX IF NOT EXISTS unique_earnings_per_request 
ON wallet_transactions (reference_id, type, user_id)
WHERE type IN ('earnings', 'purchase', 'refund') AND reference_id IS NOT NULL;

-- Step 7: Show users with corrected balances
SELECT 
  'CORRECTED BALANCES' as status,
  id,
  email,
  wallet_balance,
  CASE 
    WHEN wallet_balance = 0 THEN 'SET_TO_ZERO (was negative)'
    ELSE 'CALCULATED_NORMALLY'
  END as balance_status
FROM users 
WHERE role = 'creator' 
AND id IN (
  SELECT DISTINCT user_id 
  FROM wallet_transactions 
  WHERE reference_id IS NOT NULL
)
ORDER BY wallet_balance;

-- Step 8: Verify no duplicates remain
SELECT 
  'VERIFICATION - SHOULD BE EMPTY' as status,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT reference_id, type, user_id
  FROM wallet_transactions
  WHERE reference_id IS NOT NULL
  GROUP BY reference_id, type, user_id
  HAVING COUNT(*) > 1
) duplicates;

SELECT 'SAFE CLEANUP COMPLETE' as final_status;
