-- Fix wallet_transactions constraint to allow 'fee' type for platform fees
-- The process_request_payment function uses 'fee' type which is not currently allowed

-- Step 1: Check current constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%wallet_transactions%type%';

-- Step 2: Drop the current constraint
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Step 3: Add new constraint that includes 'fee' type
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings', 'fee'));

-- Step 4: Verify the new constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%wallet_transactions%type%';

-- Step 5: Check if there are any existing invalid types (should be none now)
SELECT DISTINCT type, COUNT(*) 
FROM wallet_transactions 
GROUP BY type 
ORDER BY type;
