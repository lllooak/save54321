-- Debug wallet_transactions table schema and unique index

-- Step 1: Check wallet_transactions table schema
SELECT 
  'WALLET_TRANSACTIONS SCHEMA' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'wallet_transactions'
ORDER BY ordinal_position;

-- Step 2: Check our unique index definition
SELECT 
  'UNIQUE INDEX INFO' as info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'wallet_transactions'
AND indexname LIKE '%unique%';

-- Step 3: Check if reference_id data type is causing the issue
SELECT 
  'REFERENCE_ID TYPE CHECK' as info,
  pg_typeof(reference_id) as reference_id_type,
  COUNT(*) as count
FROM wallet_transactions
WHERE reference_id IS NOT NULL
GROUP BY pg_typeof(reference_id)
LIMIT 5;

-- Step 4: Show recent wallet_transactions to see actual data
SELECT 
  'RECENT TRANSACTIONS' as info,
  id,
  user_id,
  type,
  reference_id,
  pg_typeof(reference_id) as ref_type,
  amount
FROM wallet_transactions
WHERE reference_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

SELECT 'WALLET TRANSACTIONS DEBUG COMPLETE' as status;
