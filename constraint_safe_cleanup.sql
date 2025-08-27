-- Alternative approach: Remove constraint temporarily, cleanup, then re-add

-- Step 1: Show current duplicates
SELECT 
  'CURRENT DUPLICATES' as status,
  reference_id,
  type,
  user_id,
  COUNT(*) as duplicate_count
FROM wallet_transactions
WHERE reference_id IS NOT NULL
GROUP BY reference_id, type, user_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- Step 2: Drop the wallet balance check constraint temporarily
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_balance_check;

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

-- Step 4: Recalculate wallet balances, ensuring no negatives
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

-- Step 5: Re-add the wallet balance constraint
ALTER TABLE users ADD CONSTRAINT users_wallet_balance_check CHECK (wallet_balance >= 0);

-- Step 6: Create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_earnings_per_request 
ON wallet_transactions (reference_id, type, user_id)
WHERE type IN ('earnings', 'purchase', 'refund') AND reference_id IS NOT NULL;

-- Step 7: Verify cleanup worked
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

-- Step 8: Show corrected balances
SELECT 
  'FINAL BALANCES' as status,
  email,
  wallet_balance,
  (SELECT COUNT(*) FROM wallet_transactions WHERE user_id = users.id AND type = 'earnings') as earning_count
FROM users 
WHERE role = 'creator' 
AND wallet_balance >= 0
ORDER BY wallet_balance DESC
LIMIT 10;

SELECT 'CLEANUP COMPLETE - DUPLICATES REMOVED' as final_status;
