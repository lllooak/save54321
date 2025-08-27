-- DIAGNOSTIC: Check actual table schemas before creating function

-- Step 1: Show requests table schema
SELECT 
  'REQUESTS TABLE COLUMNS' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'requests'
ORDER BY ordinal_position;

-- Step 2: Show earnings table schema
SELECT 
  'EARNINGS TABLE COLUMNS' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'earnings'
ORDER BY ordinal_position;

-- Step 3: Show wallet_transactions table schema
SELECT 
  'WALLET_TRANSACTIONS TABLE COLUMNS' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'wallet_transactions'
ORDER BY ordinal_position;

-- Step 4: Show sample data from requests to understand structure
SELECT 
  'SAMPLE REQUESTS DATA' as info,
  *
FROM requests
WHERE status = 'pending'
LIMIT 3;

SELECT 
  'SCHEMA CHECK COMPLETE' as status,
  'Please share results so I can create function with correct column names' as next_step;
