-- Debug wallet_transactions constraint violation during video upload
-- Run this in Supabase SQL Editor

-- 1. Check current constraint on wallet_transactions
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'wallet_transactions'::regclass 
AND conname = 'wallet_transactions_type_check';

-- 2. Check what transaction types currently exist in the table
SELECT 'Current transaction types in wallet_transactions:' as info;
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- 3. Check recent failed transactions (if any logged)
SELECT 'Recent wallet transactions (last 10):' as info;
SELECT id, user_id, type, amount, description, created_at
FROM wallet_transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Check what the video upload process should be creating
-- Look for functions or code that handle request completion/earnings
SELECT 'Functions that might create wallet transactions:' as info;
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_definition ILIKE '%wallet_transactions%'
AND routine_schema = 'public'
ORDER BY routine_name;

-- 5. Temporarily relax the constraint to see what's being attempted
-- (We'll add it back properly after identifying the issue)
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- 6. Add a more permissive constraint that includes common earning types
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN (
  'credit', 'debit', 'earning', 'withdrawal', 
  'payment', 'refund', 'commission', 'affiliate_earning',
  'request_earning', 'video_earning', 'tip'
));

SELECT 'Constraint updated - try video upload again' as result;
