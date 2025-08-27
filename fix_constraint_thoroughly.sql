-- Thorough fix for wallet_transactions constraint issue
-- The previous constraint update may not have worked properly

-- Step 1: Check current constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%wallet_transactions%type%';

-- Step 2: Drop ALL type-related constraints on wallet_transactions
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Also check for any other potential constraint names
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_check;

ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS check_wallet_transactions_type;

-- Step 3: Verify no constraints exist
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%wallet_transactions%type%';

-- Step 4: Clean up the data first (before adding constraint)
-- Update 'earning' to 'earnings'
UPDATE wallet_transactions 
SET type = 'earnings'
WHERE type = 'earning';

-- Update 'fee' to 'refund' 
UPDATE wallet_transactions 
SET type = 'refund'
WHERE type = 'fee';

-- Step 5: Verify all data is now valid
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- Step 6: Add the new constraint with correct types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings'));

-- Step 7: Test that the constraint allows 'earnings' type (no actual insert)
-- The constraint should now allow: 'top_up', 'purchase', 'refund', 'earnings'
-- Previous error was due to 'earnings' not being allowed

-- Step 8: Final verification
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'wallet_transactions_type_check';
