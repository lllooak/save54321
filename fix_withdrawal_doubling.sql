-- Fix doubled "זמין למשיכה" (Available for withdrawal) issue
-- Problems identified:
-- 1. Trigger uses 'earning' but constraint expects 'earnings' 
-- 2. Possible double wallet balance updates from trigger + RPC

-- Step 1: Update constraint to allow both 'earning' and 'earnings' (for compatibility)
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings', 'earning', 'fee'));

-- Step 2: Check current earnings and wallet_transactions to diagnose doubling
SELECT 
  'EARNINGS ANALYSIS' as analysis_type,
  e.request_id,
  e.creator_id,
  e.amount as earnings_amount,
  e.status as earnings_status,
  COUNT(wt.id) as transaction_count,
  SUM(wt.amount) as total_transaction_amount
FROM earnings e
LEFT JOIN wallet_transactions wt ON (
  wt.user_id = e.creator_id 
  AND wt.type IN ('earning', 'earnings')
  AND wt.reference_id = e.request_id::text
)
WHERE e.status = 'completed'
GROUP BY e.request_id, e.creator_id, e.amount, e.status
HAVING COUNT(wt.id) > 1  -- Show cases with multiple transactions
ORDER BY e.request_id;

-- Step 3: Check for duplicate wallet transactions
SELECT 
  'DUPLICATE TRANSACTIONS' as analysis_type,
  user_id,
  type,
  amount,
  reference_id,
  COUNT(*) as duplicate_count
FROM wallet_transactions 
WHERE type IN ('earning', 'earnings')
GROUP BY user_id, type, amount, reference_id
HAVING COUNT(*) > 1
ORDER BY user_id, reference_id;

-- Step 4: Show total earnings per creator
SELECT 
  'CREATOR TOTALS' as analysis_type,
  creator_id,
  SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_earnings,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM earnings
GROUP BY creator_id
ORDER BY creator_id;

-- Step 5: Show wallet transaction totals per creator
SELECT 
  'WALLET TRANSACTION TOTALS' as analysis_type,
  user_id as creator_id,
  SUM(CASE WHEN type IN ('earning', 'earnings') THEN amount ELSE 0 END) as earning_transactions_total,
  COUNT(CASE WHEN type IN ('earning', 'earnings') THEN 1 END) as earning_transaction_count
FROM wallet_transactions
GROUP BY user_id
HAVING SUM(CASE WHEN type IN ('earning', 'earnings') THEN amount ELSE 0 END) > 0
ORDER BY user_id;

-- These queries will help us identify:
-- 1. If there are duplicate earning transactions causing doubling
-- 2. Whether earnings amounts match wallet transaction amounts
-- 3. Which creators are affected by the doubling issue
