-- STEP 1: Clean up existing duplicates BEFORE creating unique index
-- This addresses the error: Key (reference_id, type, user_id) is duplicated

-- First, let's see what duplicates exist
SELECT 
  'CURRENT DUPLICATES' as status,
  reference_id,
  type,
  user_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as transaction_ids,
  STRING_AGG(amount::text, ', ') as amounts
FROM wallet_transactions
WHERE reference_id IS NOT NULL
GROUP BY reference_id, type, user_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Remove duplicates, keeping only the first (oldest) transaction for each group
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

-- Check how many duplicates were removed
SELECT 
  'CLEANUP COMPLETE' as status,
  COUNT(*) as remaining_transactions
FROM wallet_transactions
WHERE reference_id IS NOT NULL;

-- Verify no more duplicates exist
SELECT 
  'VERIFICATION' as status,
  reference_id,
  type,
  user_id,
  COUNT(*) as count
FROM wallet_transactions
WHERE reference_id IS NOT NULL
GROUP BY reference_id, type, user_id
HAVING COUNT(*) > 1;

-- If the above query returns no rows, we're ready to create the unique index
-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_earnings_per_request 
ON wallet_transactions (reference_id, type, user_id)
WHERE type IN ('earnings', 'purchase', 'refund') AND reference_id IS NOT NULL;

-- Recalculate wallet balances after cleanup
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

SELECT 'DUPLICATES CLEANED AND INDEX CREATED' as final_status;
