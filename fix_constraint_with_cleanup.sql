-- Fix wallet_transactions constraint by first cleaning up existing invalid data
-- This addresses: ERROR 23514: check constraint "wallet_transactions_type_check" is violated by some row

-- Step 1: Check what invalid transaction types currently exist
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- Step 2: Drop existing constraint first
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Step 3: Clean up invalid transaction types
-- Update 'earning' to 'earnings' (plural form)
UPDATE wallet_transactions 
SET type = 'earnings'
WHERE type = 'earning';

-- Update 'fee' to 'admin_deduction' (more appropriate for fee transactions)
UPDATE wallet_transactions 
SET type = 'admin_deduction'
WHERE type = 'fee';

-- Update any other invalid types to appropriate values
UPDATE wallet_transactions 
SET type = 'admin_adjustment'
WHERE type NOT IN ('top_up', 'purchase', 'refund', 'earnings', 'admin_adjustment', 'admin_deduction');

-- Step 4: Verify all types are now valid
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- Step 5: Now apply the constraint with all necessary types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings', 'admin_adjustment', 'admin_deduction'));

-- Step 6: Verify constraint was applied successfully
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'wallet_transactions_type_check';
